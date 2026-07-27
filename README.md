# 회의실 이름 공모·투표 웹앱

사내 회의실 11개의 이름을 전 직원 공모 + 투표로 정하는 모바일용 웹앱.

## 기술 스택
- React 18 + Vite
- Tailwind CSS v4
- Supabase (DB)
- Vercel 배포

## 로컬 실행
```bash
npm install
npm run dev
```
브라우저에서 http://localhost:5173 접속.

## 환경변수 (.env.local)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
Vercel 배포 시 프로젝트 설정 > Environment Variables 에 동일하게 등록.

## 진행 흐름
공모(submission) → 검수(review) → 투표(voting) → 결과(result).
단계 전환은 관리자 화면(`/admin`)에서 수동으로 진행.

## 참고
자세한 진행 상황은 `회의실이름앱_진행상황.md` 참고.
