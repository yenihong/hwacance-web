-- 화캉스 위젯 사용 통계 스키마
-- Supabase 프로젝트의 SQL Editor에서 그대로 실행하세요.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  event_type text not null check (
    event_type in (
      'app_launched',     -- 앱 실행
      'setup_completed',  -- 위젯 설정 완료
      'photo_changed',    -- 위젯 사진 변경
      'away_clicked',     -- "자리비움" 버튼 클릭
      'return_clicked'    -- "돌아옴" 버튼 클릭
    )
  ),
  app_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_type_created_idx on public.events (event_type, created_at);
create index if not exists events_device_idx on public.events (device_id);

-- 위젯(anon key)은 이벤트를 "쓰기"만 할 수 있고, 원본 테이블은 읽을 수 없게 막는다.
-- 대시보드는 아래의 집계 뷰(view)만 통해 읽는다 (기기별 원본 로그 노출 방지).
alter table public.events enable row level security;

drop policy if exists "anon can insert events" on public.events;
create policy "anon can insert events"
  on public.events for insert
  to anon
  with check (true);

-- 전체 요약 지표
create or replace view public.v_summary as
select
  count(distinct device_id) as devices_active,
  count(distinct device_id) filter (where event_type = 'setup_completed') as devices_setup,
  count(*) filter (where event_type = 'photo_changed') as photo_changes_total,
  count(*) filter (where event_type = 'away_clicked') as away_clicks_total,
  count(*) filter (where event_type = 'return_clicked') as return_clicks_total,
  min(created_at) as first_event_at,
  max(created_at) as last_event_at
from public.events;

-- 일자별 이벤트 추이
create or replace view public.v_daily_events as
select
  date_trunc('day', created_at) as day,
  event_type,
  count(*) as event_count,
  count(distinct device_id) as device_count
from public.events
group by 1, 2
order by 1;

grant usage on schema public to anon;
grant select on public.v_summary to anon;
grant select on public.v_daily_events to anon;
