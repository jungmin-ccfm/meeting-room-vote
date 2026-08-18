// 앱 전체에서 함께 쓰는 설정값

// 회의실 그룹 구성
// - maxSubmit: 공모 단계에서 그룹당 낼 수 있는 이름 후보 개수
// - pick:      최종적으로 뽑는 이름 개수 (= 실제 방 개수)
// - maxVote:   투표 단계에서 한 사람이 고를 수 있는 개수
//
// ★ maxVote 는 담당자가 정한 값입니다: 대회의실 1표 / 10층 3표 / 8층 2표.
//
//   참고: 공모 마감 후 실제 후보 개수를 보고 재검토할 수 있습니다.
//   후보가 많아지면 표가 흩어져 당선 커트라인이 낮아지고, 소수가 뭉치면
//   하위권 이름도 당선될 수 있습니다. 표를 늘리면 커트라인이 올라가 막힙니다.
//   (이전 시뮬레이션: 후보 수십 개 기준, 10층 3표일 때 10명 담합이 뚫는
//    확률 31% → 4표로 늘리면 6%. 후보가 많이 나오면 조정을 권합니다.)
export const GROUPS = [
  {
    key: 'main',
    title: '대회의실',
    maxSubmit: 1,
    pick: 1,
    maxVote: 1,
    themeField: 'theme_main',
    defaultNote: '전사 행사와 큰 회의가 열리는, 가장 상징적인 공간입니다.',
  },
  {
    key: 'floor10',
    title: '10층 회의실',
    maxSubmit: 1,
    pick: 6,
    maxVote: 3,
    themeField: 'theme_floor10',
    defaultNote: '직원들이 매일 쓰는 회의실입니다. 편하게 부를 수 있는 이름이면 좋아요.',
  },
  {
    key: 'floor8',
    title: '8층 미팅룸',
    maxSubmit: 1,
    pick: 4,
    maxVote: 2,
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

// 공용 기기 모드
// 보통은 각자 휴대폰으로 참여하므로 "다른 사람이 이어서" 버튼을 숨깁니다.
// 공용 태블릿에 띄워두거나 테스트할 때만 주소 뒤에 ?kiosk=1 을 붙이세요.
export const isKiosk = () =>
  new URLSearchParams(window.location.search).has('kiosk')
