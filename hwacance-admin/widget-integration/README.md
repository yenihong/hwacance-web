# 위젯 쪽 연동 방법

> **v1.3.1부터 `desktop-widget/`에 이미 적용되어 있습니다.** (`telemetry.js`, `main.js`, `preload.js`, `widget.html`)
> Supabase 프로젝트를 바꾸면 `desktop-widget/telemetry.js` 상단의 URL/키 두 줄만 바꾸고 다시 빌드하면 됩니다.

1. `telemetry.js`를 hwacance-widget(Electron) 프로젝트의 메인 프로세스 쪽 소스에 복사합니다.
2. 파일 상단의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 채웁니다. (`../supabase/schema.sql`을 먼저 Supabase에 실행해야 합니다)
3. Electron이 Node 18 미만이라 전역 `fetch`가 없다면 `node-fetch`를 설치하고 `const fetch = require('node-fetch')`를 추가하세요.
4. 아래 지점에 `trackEvent(...)` 호출을 추가합니다.

```js
const { trackEvent } = require('./telemetry');

// 앱이 켜질 때 (main.js의 app.whenReady() 안)
trackEvent('app_launched');

// 최초 설정 마법사를 끝까지 마쳤을 때
trackEvent('setup_completed');

// 위젯 사진을 바꿨을 때
trackEvent('photo_changed');

// "자리비움" 버튼을 눌렀을 때
trackEvent('away_clicked');

// "돌아왔어요" 버튼을 눌렀을 때 (자리비운 시간을 같이 보내면 대시보드에서 활용 가능)
trackEvent('return_clicked', { awaySeconds: 132 });
```

- 여기서 만드는 `device_id`는 무작위 UUID이고 사용자를 특정할 수 있는 정보(이름, 이메일 등)를 담지 않습니다.
- 전송 실패는 앱 동작에 영향을 주지 않도록 무시하고 콘솔에만 로그를 남기게 되어 있습니다.
- 렌더러(프론트) 쪽에서 버튼 클릭을 감지한다면, IPC로 메인 프로세스에 알려서 `trackEvent`를 호출하거나, 렌더러에도 동일한 `fetch` 호출 로직을 복사해서 써도 됩니다.
