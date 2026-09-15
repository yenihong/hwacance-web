-- 기존 것을 깨끗이 지우고 처음부터 다시 만듭니다.
drop view if exists public.v_daily_events;
drop view if exists public.v_summary;
drop table if exists public.events cascade;

create table public.events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  event_type text not null check (
    event_type in (
      'app_launched',
      'setup_completed',
      'photo_changed',
      'away_clicked',
      'return_clicked'
    )
  ),
  app_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_type_created_idx on public.events (event_type, created_at);
create index events_device_idx on public.events (device_id);

alter table public.events enable row level security;

create policy "anon can insert events"
  on public.events for insert
  to anon
  with check (true);

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

-- 확인용: 아래 결과에 event_type 컬럼이 보이면 정상입니다.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'events'
order by ordinal_position;
