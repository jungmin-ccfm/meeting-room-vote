-- ============================================================
-- 2차 설정 — 공모·투표 방식 확정에 따른 변경
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 [Run] 하세요.
-- 여러 번 실행해도 안전합니다.
-- ============================================================

-- 1) 후보 상태 컬럼 -------------------------------------------
--    ok      = 정상 (투표 대상)
--    pending = 보류 (금칙어·직급 단어 등이 걸려서 담당자 확인 대기)
--    removed = 삭제됨 (부적절해서 담당자가 내림)
alter table submissions add column if not exists status text not null default 'ok';

create index if not exists submissions_group_status_idx
  on submissions (group_key, status);


-- 2) 제출자 기록 표 (기명) ------------------------------------
--    "누가 어떤 이름을 냈는지"는 이 표에만 저장합니다.
--    브라우저에서는 넣기만 되고 읽기는 절대 안 됩니다.
--    확인은 Supabase 대시보드 > Table Editor 에서 하세요.
create table if not exists submission_authors (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  person_name   text not null,
  department    text not null,
  created_at    timestamptz not null default now()
);

alter table submission_authors enable row level security;

-- 넣기만 허용. select/update/delete 정책을 아예 만들지 않음 → 조회 불가
drop policy if exists p_authors_insert on submission_authors;
create policy p_authors_insert on submission_authors for insert with check (true);


-- 3) 방 배정 결과를 담는 칸 (이미 있으면 그냥 넘어감) ----------
alter table rooms add column if not exists assigned_name text;


-- 4) 확인 ----------------------------------------------------
select 'submissions.status 컬럼' as 항목,
       count(*) filter (where column_name = 'status') as 결과
from information_schema.columns
where table_name = 'submissions'
union all
select 'submission_authors 표', count(*)
from information_schema.tables where table_name = 'submission_authors';
