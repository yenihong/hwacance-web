// 공캉스 위젯 사용 통계 전송 모듈 (admin 대시보드: gongcance-admin/)
// Supabase 프로젝트를 바꾸면 아래 두 값만 바꾸면 됩니다. anon 키는 이벤트 쓰기만 가능한 공개 키입니다.
const SUPABASE_URL = 'https://mwdgafiymxrtjvtdupqj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AhONgwh1BLqLYlsLQxTsGQ_eJnBcjBp';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = () => path.join(app.getPath('userData'), 'gongcance-telemetry.json');
let cachedState = null;

// 사용자를 식별하지 않는 임의의 기기 UUID와 "한 번만 보내는 이벤트" 기록을 로컬에 저장한다.
function loadState() {
  if (cachedState) return cachedState;
  try {
    cachedState = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf-8'));
  } catch {
    cachedState = {};
  }
  if (!cachedState.deviceId) cachedState.deviceId = crypto.randomUUID();
  if (!Array.isArray(cachedState.sentOnce)) cachedState.sentOnce = [];
  saveState();
  return cachedState;
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE(), JSON.stringify(cachedState));
  } catch {
    /* 저장 실패해도 앱 동작에는 영향 없음 */
  }
}

// event_type: 'app_launched' | 'setup_completed' | 'photo_changed' | 'break_started' | 'break_ended'
//           | 'todo_added' | 'todo_completed' | 'asmr_on' | 'audio_changed'
async function trackEvent(eventType, metadata = {}) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gongcance_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        // 예전 형식(eyJ...) anon 키만 Authorization 헤더에 넣는다. 새 형식(sb_publishable_...)은 apikey 헤더만 쓴다.
        ...(SUPABASE_ANON_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        device_id: loadState().deviceId,
        event_type: eventType,
        app_version: app.getVersion(),
        metadata,
      }),
    });
    return res.ok;
  } catch (err) {
    // 통계 전송 실패가 앱 동작에 영향을 주면 안 되므로 조용히 로그만 남긴다.
    console.error('[telemetry] failed to send event:', eventType, err);
    return false;
  }
}

// 기기당 한 번만 보내는 이벤트 (예: setup_completed). 전송에 성공했을 때만 기록해서 실패하면 다음에 다시 보낸다.
async function trackOnce(eventType, metadata = {}) {
  const state = loadState();
  if (state.sentOnce.includes(eventType)) return;
  if (await trackEvent(eventType, metadata)) {
    state.sentOnce.push(eventType);
    saveState();
  }
}

module.exports = { trackEvent, trackOnce };
