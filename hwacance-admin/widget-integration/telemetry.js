// hwacance-widget (Electron) 메인 프로세스에 추가할 텔레메트리 모듈.
// 이 파일을 위젯 프로젝트로 복사한 뒤, 아래 두 값을 채워 넣으세요.
// Supabase 프로젝트 > Settings > API 에서 확인할 수 있습니다.
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let cachedDeviceId = null;

// 사용자를 식별하지 않는 임의의 기기 UUID를 로컬에 한 번 생성해 재사용한다.
function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  const file = path.join(app.getPath('userData'), 'telemetry-device-id.json');
  try {
    cachedDeviceId = JSON.parse(fs.readFileSync(file, 'utf-8')).deviceId;
  } catch {
    cachedDeviceId = crypto.randomUUID();
    fs.writeFileSync(file, JSON.stringify({ deviceId: cachedDeviceId }));
  }
  return cachedDeviceId;
}

// event_type: 'app_launched' | 'setup_completed' | 'photo_changed' | 'away_clicked' | 'return_clicked'
async function trackEvent(eventType, metadata = {}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        device_id: getDeviceId(),
        event_type: eventType,
        app_version: app.getVersion(),
        metadata,
      }),
    });
  } catch (err) {
    // 통계 전송 실패가 앱 동작에 영향을 주면 안 되므로 조용히 로그만 남긴다.
    console.error('[telemetry] failed to send event:', eventType, err);
  }
}

module.exports = { trackEvent, getDeviceId };
