const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { trackEvent, trackOnce } = require("./telemetry");

// 위젯 화면(렌더러)에서 보내도 되는 통계 이벤트 목록
const RENDERER_EVENTS = ["break_started", "break_ended", "todo_added", "todo_completed", "asmr_on", "study_started", "study_ended"];

const TRAY_ICON_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAACBElEQVR42u3dsU3DYBSFUU/GDJQMwBT0DEWPREHPEHQ0RFRGIIoAdhzLNj9+90S6Usro/07xunTXt69dg/U2uj9tIXI4DtHDMQgfDkH4cAjCh0MQPxyB8OEQxA9HIH44AvHDEQAAgPjJCMQPRwAAAOInIwAAAPGTEQAAgPjJCAAAAAAAPETsAAAAAAA8BAAGgAFQf/3N5cklAugBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgwS6u7r+t+WcCwPNL33Q/3wsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqAbh7PKy6pQAent5WHQCtAZxAMBQEAAAAKAdgAMFYEACqHYFfn8/f8o+OPwAaAvj4DkAggOMBAAAASUfguQAcgQAAAAAAAADgCHQEAgAAAAAAAIAj0BEIAAAAAAAAAI5ARyAAAAAAAAAAtDsCtwKw1bEHAAAAAAAAAAA4AgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKASAJs3AAAAAAAAAPDHkQaAAWAA2MoAIADAQwBgABgABoABYHEAIMhcBwAAAAAAQWR8AAD4BQCCoPgAADAIAIKQ+AAAMAoAgoD4UwAgKB4fAAAmAUBQOP65ACAoGn8OAAgKxp8LAIRC4ZcAgKBI/CUAQNh5+LUAgLDT8GsDAGFn4bcCAMMOoh/vHcnTOIFJaQDyAAAAAElFTkSuQmCC";

const WIDGET_WIDTH = 252;
const WIDGET_HEIGHT = 160;
const MARGIN = 20;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "aac", "flac", "mp4", "webm"];

const POSITION_FILE = path.join(app.getPath("userData"), "widget-position.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "widget-settings.json");

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let savePositionTimer = null;

function loadSavedPosition(){
  try{
    const raw = fs.readFileSync(POSITION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if(typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
  }catch(e){ /* no saved position yet, or unreadable — fall back to default */ }
  return null;
}

function savePosition(x, y){
  clearTimeout(savePositionTimer);
  savePositionTimer = setTimeout(() => {
    try{ fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y })); }catch(e){ /* ignore write failures */ }
  }, 300);
}

function loadSettings(){
  try{
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      photoDataUrl: typeof parsed.photoDataUrl === "string" ? parsed.photoDataUrl : null,
      photoSource: typeof parsed.photoSource === "string" ? parsed.photoSource : null,
      photoCrop: sanitizeCrop(parsed.photoCrop),
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : null,
      audioFile: typeof parsed.audioFile === "string" ? parsed.audioFile : null,
      audioName: typeof parsed.audioName === "string" ? parsed.audioName : null
    };
  }catch(e){
    return { photoDataUrl: null, photoSource: null, photoCrop: null, nickname: null, audioFile: null, audioName: null };
  }
}

// 사진 편집 값(확대 배율과 틀 중심 위치)만 숫자로 걸러서 저장한다.
function sanitizeCrop(crop){
  if(!crop || typeof crop !== "object") return null;
  const z = Number(crop.z), cx = Number(crop.cx), cy = Number(crop.cy);
  if(!isFinite(z) || !isFinite(cx) || !isFinite(cy)) return null;
  return { z: Math.min(4, Math.max(0.5, z)), cx: Math.min(3, Math.max(-2, cx)), cy: Math.min(3, Math.max(-2, cy)) };
}

function saveSettings(settings){
  try{ fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings)); }catch(e){ /* ignore write failures */ }
}

// 위젯 화면에는 파일 경로 대신 바로 재생 가능한 URL을 넘긴다. 파일이 사라졌으면 null → 기본 음악으로 돌아간다.
function withAudioUrl(settings){
  const out = Object.assign({}, settings, { audioUrl: null });
  if(settings.audioFile){
    const filePath = path.join(app.getPath("userData"), settings.audioFile);
    try{
      const stat = fs.statSync(filePath);
      out.audioUrl = pathToFileURL(filePath).href + "?v=" + Math.floor(stat.mtimeMs);
    }catch(e){ out.audioUrl = null; }
  }
  return out;
}

// 사진 원본은 설정창에서만 필요하다. 위젯에는 잘라낸 사진만 보낸다.
function withoutPhotoSource(settings){
  const out = Object.assign({}, settings);
  delete out.photoSource;
  return out;
}

function broadcastSettings(settings){
  if(mainWindow){ mainWindow.webContents.send("settings:updated", withoutPhotoSource(withAudioUrl(settings))); }
}

function removeAudioFile(fileName){
  if(!fileName) return;
  try{ fs.unlinkSync(path.join(app.getPath("userData"), fileName)); }catch(e){ /* 재생 중이라 잠겼으면 다음 실행 때 정리 */ }
}

// 설정에 없는 예전 배경음 파일(교체하다 남은 것)을 정리한다.
function cleanupStaleAudio(){
  try{
    const keep = loadSettings().audioFile;
    fs.readdirSync(app.getPath("userData")).forEach((name) => {
      if(/^custom-audio-/.test(name) && name !== keep) removeAudioFile(name);
    });
  }catch(e){ /* ignore */ }
}

function bottomRightOf(display){
  const { width, height, x: originX, y: originY } = display.workArea;
  return { x: originX + width - WIDGET_WIDTH - MARGIN, y: originY + height - WIDGET_HEIGHT - MARGIN };
}

function createWindow(){
  const saved = loadSavedPosition();
  const startPos = saved || bottomRightOf(screen.getPrimaryDisplay());

  mainWindow = new BrowserWindow({
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    x: startPos.x,
    y: startPos.y,
    frame: false,
    resizable: false,
    movable: true,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "widget.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on("moved", () => {
    const [x, y] = mainWindow.getPosition();
    savePosition(x, y);
  });
}

function createSettingsWindow(){
  if(settingsWindow){ settingsWindow.show(); settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 340,
    height: 680,
    resizable: false,
    title: "공캉스 위젯 설정",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

function moveToDisplay(display){
  if(!mainWindow) return;
  const pos = bottomRightOf(display);
  mainWindow.setPosition(pos.x, pos.y);
  savePosition(pos.x, pos.y);
}

function buildTrayMenu(){
  const displays = screen.getAllDisplays();
  const displayItems = displays.map((d, i) => ({
    label: displays.length > 1
      ? `모니터 ${i + 1}로 이동 (${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ", 주 모니터" : ""})`
      : "화면 오른쪽 아래로 이동",
    click: () => moveToDisplay(d)
  }));

  return Menu.buildFromTemplate([
    {
      label: "보이기 / 숨기기",
      click: () => {
        if(!mainWindow) return;
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    },
    { label: "설정... (사진 바꾸기)", click: () => createSettingsWindow() },
    { type: "separator" },
    ...displayItems,
    { type: "separator" },
    { label: "종료", click: () => app.quit() }
  ]);
}

function createTray(){
  try{
    const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
    if(icon.isEmpty()){
      dialog.showErrorBox("트레이 아이콘 오류", "아이콘 이미지 데이터가 비어있습니다 (TRAY_ICON_DATA_URL 손상 가능성).");
    }
    tray = new Tray(icon);
    tray.setToolTip("공캉스 위젯");
    tray.setContextMenu(buildTrayMenu());
    tray.on("click", () => {
      if(!mainWindow) return;
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });

    // 모니터 연결/해제 시 이동 메뉴 목록을 다시 만든다.
    screen.on("display-added", () => tray.setContextMenu(buildTrayMenu()));
    screen.on("display-removed", () => tray.setContextMenu(buildTrayMenu()));
  }catch(e){
    dialog.showErrorBox("트레이 아이콘 생성 실패", String((e && e.stack) || e));
  }
}

ipcMain.handle("settings:get", (event) => {
  const settings = withAudioUrl(loadSettings());
  const fromSettingsWindow = settingsWindow && event.sender === settingsWindow.webContents;
  return fromSettingsWindow ? settings : withoutPhotoSource(settings);
});
ipcMain.handle("settings:set", (_event, payload) => {
  const previous = loadSettings();
  const photoDataUrl = (payload && payload.photoDataUrl) || null;
  const settings = Object.assign({}, previous, {
    photoDataUrl: photoDataUrl,
    photoSource: photoDataUrl && payload && typeof payload.photoSource === "string" ? payload.photoSource : null,
    photoCrop: photoDataUrl ? sanitizeCrop(payload && payload.photoCrop) : null,
    nickname: (payload && payload.nickname) || null
  });
  saveSettings(settings);
  broadcastSettings(settings);
  trackOnce("setup_completed");
  if(settings.photoDataUrl && settings.photoDataUrl !== previous.photoDataUrl) trackEvent("photo_changed");
  return true;
});
ipcMain.handle("audio:choose", async () => {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: "배경음 파일 선택",
    properties: ["openFile"],
    filters: [{ name: "오디오 파일", extensions: AUDIO_EXTENSIONS }]
  });
  if(result.canceled || !result.filePaths.length) return { ok: false, canceled: true };

  const source = result.filePaths[0];
  try{
    if(fs.statSync(source).size > MAX_AUDIO_BYTES){
      return { ok: false, error: "파일이 너무 커요 (200MB 이하로 골라주세요)" };
    }
    // 재생 중인 파일을 덮어쓰다 잠기지 않도록 매번 새 이름으로 복사한다.
    const fileName = "custom-audio-" + Date.now() + (path.extname(source).toLowerCase() || ".mp3");
    await fs.promises.copyFile(source, path.join(app.getPath("userData"), fileName));
    const previous = loadSettings();
    const settings = Object.assign(previous, { audioFile: fileName, audioName: path.basename(source) });
    saveSettings(settings);
    removeAudioFile(previous.audioFile === fileName ? null : previous.audioFile);
    broadcastSettings(settings);
    trackEvent("audio_changed");
    return { ok: true, audioName: settings.audioName };
  }catch(e){
    return { ok: false, error: "파일을 불러오지 못했어요, 다른 파일로 시도해주세요" };
  }
});
ipcMain.handle("audio:reset", () => {
  const settings = loadSettings();
  const oldFile = settings.audioFile;
  settings.audioFile = null;
  settings.audioName = null;
  saveSettings(settings);
  broadcastSettings(settings);
  removeAudioFile(oldFile);
  return { ok: true };
});
ipcMain.on("settings:close", () => {
  if(settingsWindow) settingsWindow.close();
});
ipcMain.on("settings:open", () => {
  createSettingsWindow();
});
ipcMain.on("app:quit", (event) => {
  if(mainWindow && event.sender === mainWindow.webContents) app.quit();
});
ipcMain.on("telemetry:track", (_event, eventType, metadata) => {
  if(!RENDERER_EVENTS.includes(eventType)) return;
  const safe = {};
  if(metadata && typeof metadata.breakMinutes === "number") safe.breakMinutes = metadata.breakMinutes;
  if(metadata && typeof metadata.studyMinutes === "number") safe.studyMinutes = metadata.studyMinutes;
  trackEvent(eventType, safe);
});

app.whenReady().then(() => {
  cleanupStaleAudio();
  createWindow();
  createTray();
  const isFirstRun = !fs.existsSync(SETTINGS_FILE);
  if(isFirstRun) createSettingsWindow();
  trackEvent("app_launched");
  // 이전 버전에서 이미 설정을 마친 사용자도 설정 완료로 한 번 집계한다.
  if(!isFirstRun) trackOnce("setup_completed");
});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") app.quit();
});
