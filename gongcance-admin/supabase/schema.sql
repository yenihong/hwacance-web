-- 공캉스 위젯 사용 통계 스키마
-- 화캉스 admin과 같은 Supabase 프로젝트에 그대로 실행해도 됩니다.
-- (테이블/뷰 이름에 gongcance_ 접두사를 붙여 화캉스 events 테이블과 섞이지 않습니다)

create table if not exists public.gongcance_events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  event_type text not null check (
    event_type in (
      'app_launched',     -- 앱 실행
      'setup_completed',  -- 최초 설정 저장 완료
      'photo_changed',    -- 위젯 사진 변경
      'break_started',    -- 쉼 시작 ("공부 시작" 버튼 → "쉬는 중")
      'break_ended',      -- 쉼 종료 ("공부 재개" 버튼), metadata.breakMinutes
      'todo_added',       -- 할 일 추가
      'todo_completed',   -- 할 일 체크
      'asmr_on',          -- ASMR(배경음) 켜기
      'audio_changed',    -- 배경음 파일 변경
      'study_started',    -- 시작 화면에서 "공부 시작" 클릭
      'study_ended'       -- "공부 종료" 확정, metadata.studyMinutes(그날 총 공부 시간)
    )
  ),
  app_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gongcance_events_type_created_idx on public.gongcance_events (event_type, created_at);
create index if not exists gongcance_events_device_idx on public.gongcance_events (device_id);

-- 위젯(anon key)은 이벤트를 "쓰기"만 할 수 있고, 원본 테이블은 읽을 수 없게 막는다.
-- 대시보드는 아래의 집계 뷰(view)만 통해 읽는다 (기기별 원본 로그 노출 방지).
alter table public.gongcance_events enable row level security;

drop policy if exists "anon can insert gongcance events" on public.gongcance_events;
create policy "anon can insert gongcance events"
  on public.gongcance_events for insert
  to anon
  with check (true);

-- 전체 요약 지표
create or replace view public.gongcance_v_summary as
select
  count(distinct device_id) as devices_active,
  count(distinct device_id) filter (where event_type = 'setup_completed') as devices_setup,
  count(*) filter (where event_type = 'photo_changed') as photo_changes_total,
  count(*) filter (where event_type = 'break_started') as breaks_started_total,
  count(*) filter (where event_type = 'break_ended') as breaks_ended_total,
  round(avg((metadata->>'breakMinutes')::numeric) filter (where event_type = 'break_ended'), 1) as avg_break_minutes,
  count(*) filter (where event_type = 'todo_added') as todos_added_total,
  count(*) filter (where event_type = 'todo_completed') as todos_completed_total,
  count(*) filter (where event_type = 'asmr_on') as asmr_on_total,
  count(*) filter (where event_type = 'audio_changed') as audio_changes_total,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at,
  count(*) filter (where event_type = 'study_started') as study_started_total,
  count(*) filter (where event_type = 'study_ended') as study_ended_total,
  round(avg((metadata->>'studyMinutes')::numeric) filter (where event_type = 'study_ended'), 1) as avg_study_minutes
from public.gongcance_events;

-- 일자별 이벤트 추이 (한국 시간 기준 날짜)
create or replace view public.gongcance_v_daily_events as
select
  date_trunc('day', created_at at time zone 'Asia/Seoul') as day,
  event_type,
  count(*) as event_count,
  count(distinct device_id) as device_count
from public.gongcance_events
group by 1, 2
order by 1;

-- 일자별 활동 기기 수 (이벤트 종류와 무관하게 고유 기기)
create or replace view public.gongcance_v_daily_devices as
select
  date_trunc('day', created_at at time zone 'Asia/Seoul') as day,
  count(distinct device_id) as device_count
from public.gongcance_events
group by 1
order by 1;

-- 앱 버전별 기기 수 (각 기기의 가장 최근 버전 기준)
create or replace view public.gongcance_v_versions as
select app_version, count(*) as device_count
from (
  select distinct on (device_id) device_id, coalesce(app_version, '알 수 없음') as app_version
  from public.gongcance_events
  order by device_id, created_at desc
) latest
group by 1
order by 2 desc;

grant usage on schema public to anon;
grant select on public.gongcance_v_summary to anon;
grant select on public.gongcance_v_daily_events to anon;
grant select on public.gongcance_v_daily_devices to anon;
grant select on public.gongcance_v_versions to anon;
