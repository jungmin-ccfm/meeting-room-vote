// 앱 전체에서 함께 쓰는 설정값

// 회의실 그룹 구성
// - maxSubmit: 공모 단계에서 그룹당 낼 수 있는 이름 후보 개수
// - maxVote:   투표 단계에서 그룹에서 고를 수 있는 개수
export const GROUPS = [
  { key: 'main', title: '대회의실', maxSubmit: 2, maxVote: 1, themeField: 'theme_main' },
  { key: 'floor10', title: '10층 회의실', maxSubmit: 2, maxVote: 6, themeField: 'theme_floor10' },
  { key: 'floor8', title: '8층 미팅룸', maxSubmit: 2, maxVote: 4, themeField: 'theme_floor8' },
]

// 진행 단계 표시(상단 스텝바)에 쓰는 3단계
export const STEPS = [
  { key: 'submission', label: '공모' },
  { key: 'voting', label: '투표' },
  { key: 'result', label: '결과' },
]

// phase 값에 따라 스텝바에서 몇 번째를 강조할지
export function stepKeyForPhase(phase) {
  if (phase === 'result') return 'result'
  if (phase === 'voting') return 'voting'
  return 'submission' // submission, review 는 첫 단계로 표시
}
