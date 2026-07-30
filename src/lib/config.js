// 앱 전체에서 함께 쓰는 설정값

// 회의실 그룹 구성
// - maxSubmit: 공모 단계에서 그룹당 낼 수 있는 이름 후보 개수
// - pick:      최종적으로 뽑는 이름 개수 (= 실제 방 개수)
// - maxVote:   투표 단계에서 고를 수 있는 개수
//
// maxVote 를 pick 보다 적게, 그러나 너무 적지 않게 잡은 이유:
//   시뮬레이션 결과 표가 너무 적으면 한 팀(10~15명)이 뭉치는 것만으로
//   하위권 이름이 당선됐다. 표를 늘리면 당선 커트라인이 올라가 담합이 막힌다.
//   10층 3표 → 10명 담합 31% 뚫림 / 4표 → 6% 로 감소.
export const GROUPS = [
  {
    key: 'main',
    title: '대회의실',
    maxSubmit: 1,
    pick: 1,
    maxVote: 3,
    themeField: 'theme_main',
    defaultNote: '전사 행사와 큰 회의가 열리는, 가장 상징적인 공간입니다.',
  },
  {
    key: 'floor10',
    title: '10층 회의실',
    maxSubmit: 2,
    pick: 6,
    maxVote: 4,
    themeField: 'theme_floor10',
    defaultNote: '직원들이 매일 쓰는 회의실입니다. 편하게 부를 수 있는 이름이면 좋아요.',
  },
  {
    key: 'floor8',
    title: '8층 미팅룸',
    maxSubmit: 2,
    pick: 4,
    maxVote: 3,
    themeField: 'theme_floor8',
    defaultNote: '고객사 손님을 모시는 공간입니다. 조금 더 단정한 이름이 좋아요.',
  },
]

export const getGroup = (key) => GROUPS.find((g) => g.key === key)

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

// 이름 길이 제한
export const NAME_MAX = 12
