-- ============================================================
-- 전체 초기화 — 테스트 데이터를 지우고 공모 단계로 되돌립니다
--
-- 언제 쓰나:
--   · 테스트를 마치고 실제 공모를 시작하기 직전
--   · 테스트를 처음부터 다시 하고 싶을 때
--
-- 어떻게:
--   Supabase 대시보드 > SQL Editor > New query 에 아래를 전부 붙여넣고 [Run]
--
-- ⚠ 되돌릴 수 없습니다. 실제 공모가 진행 중일 때는 절대 실행하지 마세요.
-- ============================================================

-- 순서 중요: 투표 → 제출자기록 → 이름 → 참여자
delete from votes;
delete from submission_authors;
delete from submissions;
delete from participants;

-- 방 배정 지우기
update rooms set assigned_name = null;

-- 공모 단계로 되돌리기
update settings set phase = 'submission' where id = 1;

-- 확인
select
  (select count(*) from submissions)  as 이름,
  (select count(*) from participants) as 참여자,
  (select count(*) from votes)        as 투표,
  (select phase from settings where id = 1) as 단계;
