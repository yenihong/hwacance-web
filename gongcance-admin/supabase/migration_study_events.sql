-- 이미 schema.sql을 실행한 Supabase에 "공부 시작/공부 종료" 이벤트를 추가하는 마이그레이션 (한 번만 실행)
-- 새로 설치하는 경우에는 schema.sql만 실행하면 됩니다.

alter table public.gongcance_events drop constraint if exists gongcance_events_event_type_check;
alter table public.gongcance_events add constraint gongcance_events_event_type_check check (
  event_type in (
    'app_launched', 'setup_completed', 'photo_changed', 'break_started', 'break_ended',
    'todo_added', 'todo_completed', 'asmr_on', 'audio_changed',
    'study_started', 'study_ended'
  )
);

-- 뷰는 기존 열 뒤에 새 열만 덧붙이므로 create or replace로 바꿀 수 있다.
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

grant select on public.gongcance_v_summary to anon;
