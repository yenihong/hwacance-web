# 공캉스 위젯 쪽 연동 방법

> **v1.0.7부터 `desktop-widget-gongcance/`에 이미 적용되어 있습니다.** (`telemetry.js`, `main.js`, `preload.js`, `widget.html`)
> 위젯 쪽 실제 코드는 아래 예시와 조금 다릅니다. `setup_completed`는 `trackOnce`로 기기당 한 번만 보내고, 이전 버전에서 이미 설정을 마친 사용자도 첫 실행 때 집계합니다.
> Supabase 프로젝트를 바꾸면 `desktop-widget-gongcance/telemetry.js` 상단의 URL/키 두 줄만 바꾸고 다시 빌드하면 됩니다.

대상 프로젝트: `desktop-widget-gongcance/` (Electron 31 → 전역 `fetch` 사용 가능, 별도 패키지 설치 불필요)

1. `telemetry.js`를 `desktop-widget-gongcance/`에 복사합니다.
2. 파일 상단의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 채웁니다. (`../supabase/schema.sql`을 먼저 Supabase에 실행해야 합니다)
3. `package.json`의 `build.files`에 `"telemetry.js"`를 추가합니다. (빠뜨리면 빌드된 exe에서 `require`가 실패합니다)
4. 아래 지점에 호출을 추가합니다.

## main.js (메인 프로세스)

```js
const { trackEvent } = require('./telemetry');

// 렌더러(widget.html)에서 보내는 이벤트만 허용 목록으로 받는다.
const RENDERER_EVENTS = ['break_started', 'break_ended', 'todo_added', 'todo_completed', 'asmr_on'];
ipcMain.on('telemetry:track', (_event, eventType, metadata) => {
  if (RENDERER_EVENTS.includes(eventType)) trackEvent(eventType, metadata || {});
});

// app.whenReady() 안
trackEvent('app_launched');

// ipcMain.handle("settings:set", ...) 안, saveSettings(settings) 직전
const previous = loadSettings();
if (!fs.existsSync(SETTINGS_FILE)) trackEvent('setup_completed');
if (payload && payload.photoDataUrl && payload.photoDataUrl !== previous.photoDataUrl) trackEvent('photo_changed');

// ipcMain.handle("audio:choose", ...) 안, 복사 성공 후 return 직전
trackEvent('audio_changed');
```

> `setup_completed`는 설정 파일이 아직 없을 때(최초 실행 후 첫 저장) 한 번만 보내집니다.

## preload.js

`hwacanceSettings` 객체에 한 줄 추가합니다.

```js
track: (eventType, metadata) => ipcRenderer.send('telemetry:track', eventType, metadata),
```

## widget.html (렌더러)

```js
function track(type, meta){
  if(window.hwacanceSettings && window.hwacanceSettings.track) window.hwacanceSettings.track(type, meta);
}

// toggleStopwatch() 안
//   running → 종료 분기 (records.push 다음)
track('break_ended', { breakMinutes: Math.round(durationMin * 10) / 10 });
//   시작 분기 (state.running = true 다음)
track('break_started');

// toggleAsmr() 안, state.asmrOn 이 true 가 된 분기
track('asmr_on');

// todoFormEl submit 핸들러, todos.push(...) 다음
track('todo_added');

// 체크박스 change 핸들러, cb.checked 가 true 일 때만
if(cb.checked) track('todo_completed');
```

- 할 일 **내용(텍스트)이나 닉네임·사진은 절대 보내지 않습니다.** 이벤트 종류와 쉼 시간(분)만 전송합니다.
- `device_id`는 무작위 UUID로, 사용자를 특정할 수 있는 정보가 없습니다.
- 전송 실패는 앱 동작에 영향을 주지 않도록 무시하고 콘솔에만 로그를 남깁니다.
- 연동 후에는 `package.json`의 `version`을 올리고 새로 빌드·릴리스해야 이벤트가 쌓이기 시작합니다.
