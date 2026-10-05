# 공캉스 위젯 admin 대시보드

공캉스 위젯(`desktop-widget-gongcance`, 스터디 브레이크 스톱워치) 사용 현황을 팀원과 공유해서 보기 위한 대시보드입니다.
구조와 운영 방식은 [화캉스 admin](../hwacance-admin/README.md)과 같습니다.

- **다운로드 수**: GitHub Releases API에서 실시간으로 가져옵니다. 같은 저장소에 화캉스 위젯 릴리스도 있으므로 `gongcance-widget`으로 시작하는 파일만 셉니다.
- **설정 완료 / 쉼 기록 / 할 일 / 사진·배경음 변경 / ASMR**: 위젯 앱이 Supabase로 보내는 이벤트를 집계해서 보여줍니다. 위젯 쪽에 연동 코드를 넣어야 값이 쌓입니다.

## 폴더 구조

```
supabase/schema.sql         Supabase에 실행할 테이블/뷰/정책 정의 (gongcance_ 접두사)
widget-integration/         위젯(Electron) 프로젝트에 붙여넣을 텔레메트리 코드 + 가이드
dashboard/                  팀원에게 공유할 정적 웹 대시보드
```

## 처음 설정 순서

1. **Supabase 프로젝트** — 화캉스 admin에서 쓰는 프로젝트를 그대로 사용합니다. (새로 만들어도 됩니다)
2. **스키마 실행** — SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 내용을 그대로 실행합니다.
   - `gongcance_events` 테이블: 위젯이 이벤트를 쓰기만 할 수 있음 (읽기 불가)
   - `gongcance_v_summary`, `gongcance_v_daily_events`, `gongcance_v_daily_devices`, `gongcance_v_versions` 뷰: 대시보드가 읽는 집계 데이터만 노출
   - 화캉스의 `events` 테이블과 이름이 겹치지 않아 기존 데이터에 영향이 없습니다.
3. **위젯에 연동** — [widget-integration/README.md](widget-integration/README.md) 안내대로 `telemetry.js`를 추가하고 이벤트 호출을 붙인 뒤, 버전을 올려 새로 빌드·릴리스합니다.
4. **대시보드 설정** — `dashboard/config.js`에 화캉스 admin과 같은 Supabase URL/anon key가 이미 들어 있습니다. 다른 프로젝트를 쓴다면 `config.example.js`를 참고해 바꿔주세요.
5. **로컬 확인**
   ```bash
   cd dashboard && npx serve .
   ```
   또는 `dashboard/index.html`을 브라우저로 바로 열어도 됩니다.

## 팀원과 공유하기

`dashboard/` 폴더는 정적 파일뿐이라 Vercel, Netlify, GitHub Pages 등 아무 곳에나 올리면 바로 공유 가능한 URL이 생깁니다. (예: Netlify Drop에 `dashboard` 폴더를 드래그)

> **주의**: `anon` 키는 "읽기 전용 집계 뷰"에만 접근 권한이 있어서 배포된 정적 사이트에 포함되어도 원본 이벤트 로그가 새어나가지 않습니다. 다만 URL을 아는 사람은 누구나 요약 통계를 볼 수 있으니, 필요하면 호스팅의 비밀번호 보호 기능을 사용하세요.

## 지표 정의

| 지표 | 정의 |
|---|---|
| 누적 다운로드 | `gongcance-widget`으로 시작하는 GitHub Release asset의 `download_count` 합 |
| 설정 완료 기기 수 | `setup_completed` 이벤트를 1번 이상 보낸 고유 `device_id` 수 |
| 사용 이력이 있는 기기 수 | 어떤 이벤트든 1건 이상 보낸 고유 `device_id` 수 |
| 쉼 기록 | `break_ended`("공부 재개" 클릭) 횟수, 평균 쉼은 `metadata.breakMinutes` 평균 |
| 할 일 추가 / 완료율 | `todo_added` 횟수, `todo_completed ÷ todo_added` |
| 사진 변경 / ASMR / 배경음 변경 | 각 이벤트 발생 총 횟수와 기기당 평균 |
| 사용 중인 앱 버전 | 기기별 가장 최근 이벤트의 `app_version` 분포 |

요약 카드와 릴리스/버전 표는 전체 기간 누적이고, 그래프·일자별 표는 상단에서 고른 기간(7/30/90일/전체)만 반영합니다. 날짜는 한국 시간 기준입니다.
