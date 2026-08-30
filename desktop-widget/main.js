const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const TRAY_ICON_DATA_URL = "data:image/png;base64,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";

const WIDGET_WIDTH = 320;
const WIDGET_HEIGHT = 196;
const MARGIN = 20;

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
      nickname: typeof parsed.nickname === "string" ? parsed.nickname : null
    };
  }catch(e){
    return { photoDataUrl: null, nickname: null };
  }
}

function saveSettings(settings){
  try{ fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings)); }catch(e){ /* ignore write failures */ }
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
    height: 460,
    resizable: false,
    title: "화캉스 위젯 설정",
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
    tray.setToolTip("화캉스 위젯");
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

ipcMain.handle("settings:get", () => loadSettings());
ipcMain.handle("settings:set", (_event, payload) => {
  const settings = {
    photoDataUrl: (payload && payload.photoDataUrl) || null,
    nickname: (payload && payload.nickname) || null
  };
  saveSettings(settings);
  if(mainWindow){ mainWindow.webContents.send("settings:updated", settings); }
  return true;
});
ipcMain.on("settings:close", () => {
  if(settingsWindow) settingsWindow.close();
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  const isFirstRun = !fs.existsSync(SETTINGS_FILE);
  if(isFirstRun) createSettingsWindow();
});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") app.quit();
});
