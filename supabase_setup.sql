-- ============================================================
-- 회의실 이름 공모·투표 앱 - 데이터베이스 초기 설정 (간결 버전)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run] 하세요.
-- 여러 번 실행해도 안전합니다.
-- ============================================================

-- 표 5개 만들기 -----------------------------------------------
create table if not exists settings (
  id            int primary key default 1,
  phase         text not null default 'submission',
  theme_main    text default '',
  theme_floor10 text default '',
  theme_floor8  text default '',
  constraint settings_single_row check (id = 1)
);

create table if not exists rooms (
  id            uuid primary key default gen_random_uuid(),
  group_key     text not null,
  room_label    text not null,
  assigned_name text,
  sort_order    int default 0
);

create table if not exists submissions (
  id          uuid primary key default gen_random_uuid(),
  group_key   text not null,
  name        text not null,
  is_hidden   boolean not null default false,
  merged_into uuid references submissions(id),
  created_at  timestamptz not null default now()
);

create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  person_name text not null,
  department  text not null,
  phase       text not null,
  created_at  timestamptz not null default now(),
  unique (person_name, department, phase)
);

create table if not exists votes (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id),
  created_at    timestamptz not null default now()
);

-- 접근 권한(RLS) 켜기 ----------------------------------------
alter table settings     enable row level security;
alter table rooms        enable row level security;
alter table submissions  enable row level security;
alter table participants enable row level security;
alter table votes        enable row level security;

-- 정책: settings/rooms/submissions/participants 는 모두 허용
drop policy if exists p_settings on settings;
create policy p_settings on settings for all using (true) with check (true);

drop policy if exists p_rooms on rooms;
create policy p_rooms on rooms for all using (true) with check (true);

drop policy if exists p_submissions on submissions;
create policy p_submissions on submissions for all using (true) with check (true);

drop policy if exists p_participants on participants;
create policy p_participants on participants for all using (true) with check (true);

-- 정책: votes 는 등록만 허용, 읽기(집계)는 '결과 단계'에서만
drop policy if exists p_votes_insert on votes;
drop policy if exists p_votes_read on votes;
create policy p_votes_insert on votes for insert with check (true);
create policy p_votes_read on votes for select using ((select phase from settings where id = 1) = 'result');

-- 초기 데이터 ------------------------------------------------
insert into settings (id, phase) values (1, 'submission') on conflict (id) do nothing;

insert into rooms (group_key, room_label, sort_order)
select v.group_key, v.room_label, v.sort_order
from (values
  ('main',    '대회의실',      0),
  ('floor10', '10층 회의실 1', 1),
  ('floor10', '10층 회의실 2', 2),
  ('floor10', '10층 회의실 3', 3),
  ('floor10', '10층 회의실 4', 4),
  ('floor10', '10층 회의실 5', 5),
  ('floor10', '10층 회의실 6', 6),
  ('floor8',  '8층 미팅룸 1',  1),
  ('floor8',  '8층 미팅룸 2',  2),
  ('floor8',  '8층 미팅룸 3',  3),
  ('floor8',  '8층 미팅룸 4',  4)
) as v(group_key, room_label, sort_order)
where not exists (select 1 from rooms);
