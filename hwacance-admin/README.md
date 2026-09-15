# 화캉스 위젯 admin 대시보드

hwacance-widget(데스크톱 위젯) 사용 현황을 팀원과 공유해서 보기 위한 대시보드입니다.

- **다운로드 수**: GitHub Releases API에서 실시간으로 가져옵니다 (별도 설정 불필요, public repo 기준).
- **설정 완료 / 사진 변경 / 자리비움·돌아옴 클릭**: 위젯 앱이 Supabase로 보내는 이벤트를 집계해서 보여줍니다. 위젯 쪽에 연동 코드를 넣어야 값이 쌓입니다.

## 폴더 구조

```
supabase/schema.sql         Supabase에 실행할 테이블/뷰/정책 정의
widget-integration/         위젯(Electron) 프로젝트에 붙여넣을 텔레메트리 코드 + 가이드
dashboard/                  팀원에게 공유할 정적 웹 대시보드
```

## 처음 설정 순서

1. **Supabase 프로젝트 생성** — [supabase.com](https://supabase.com) 에서 새 프로젝트를 만듭니다 (무료 플랜으로 충분).
2. **스키마 실행** — 프로젝트의 SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 내용을 그대로 실행합니다.
   - `events` 테이블: 위젯이 이벤트를 쓰기만 할 수 있음 (읽기 불가)
   - `v_summary`, `v_daily_events` 뷰: 대시보드가 읽는 집계 데이터만 노출 (기기별 원본 로그는 노출 안 됨)
3. **API 키 확인** — Settings > API 에서 Project URL과 `anon public` 키를 복사해둡니다.
4. **위젯에 연동** — [widget-integration/README.md](widget-integration/README.md) 안내대로 `telemetry.js`를 hwacance-widget 프로젝트에 추가하고, 설정 완료/사진 변경/자리비움/돌아옴 버튼 핸들러에 `trackEvent(...)`를 호출하도록 붙입니다.
5. **대시보드 설정**
   ```bash
   cp dashboard/config.example.js dashboard/config.js
   ```
   `dashboard/config.js`에 같은 Supabase URL/anon key, 그리고 위젯의 GitHub repo(`yenihong/hwacance-web`)를 채웁니다.
6. **로컬 확인**
   ```bash
   cd dashboard && npx serve .
   ```
   또는 `dashboard/index.html`을 브라우저로 바로 열어도 됩니다.

## 팀원과 공유하기

`dashboard/` 폴더는 정적 파일뿐이라 Vercel, Netlify, GitHub Pages 등 아무 곳에나 올리면 바로 공유 가능한 URL이 생깁니다. 예를 들어 Netlify Drop(https://app.netlify.com/drop)에 `dashboard` 폴더를 드래그하면 몇 초 안에 링크가 나옵니다.

> **주의**: `dashboard/config.js`에 들어가는 `anon` 키는 "읽기 전용 집계 뷰"에만 접근 권한이 있어서 배포된 정적 사이트에 포함되어도 원본 이벤트 로그가 새어나가지 않습니다. 다만 URL을 아는 사람은 누구나 요약 통계를 볼 수 있으니, 더 강하게 막고 싶다면 Netlify/Vercel의 비밀번호 보호 기능이나 사내 VPN 뒤에 배포하는 것을 권장합니다.

## 지표 정의

| 지표 | 정의 |
|---|---|
| 누적 다운로드 | GitHub Release의 모든 asset `download_count` 합 |
| 설정 완료 기기 수 | `setup_completed` 이벤트를 1번 이상 보낸 고유 `device_id` 수 |
| 사용 이력이 있는 기기 수 | 어떤 이벤트든 1건 이상 보낸 고유 `device_id` 수 |
| 사진 변경 / 자리비움 / 돌아옴 | 각 이벤트 발생 총 횟수, 그리고 설정 완료 기기당 평균 횟수 |

요약 카드는 전체 기간 누적이고, 그래프·표는 상단에서 고른 기간(7/30/90일/전체)만 반영합니다.
