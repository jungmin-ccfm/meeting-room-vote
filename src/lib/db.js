// 데이터 창고(Supabase)와 실제로 이야기하는 함수들을 모아둔 곳.
// 화면 파일(App.jsx, pages/*)에서는 여기 함수만 부르면 됩니다.
import { supabase } from './supabase'

// ---------------------------------------------------------------
// 설정 한 줄 읽기 (현재 단계 phase + 그룹별 테마 안내문)
// ---------------------------------------------------------------
export async function fetchSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw error
  return data
}

// ---------------------------------------------------------------
// 이름 후보 제출하기
//
// 순서가 중요합니다.
// 1) participants(참여자 명단)에 먼저 등록 → 같은 (이름, 부서)가 이미 있으면
//    데이터베이스가 거절하므로 "중복 참여"를 여기서 걸러냅니다.
// 2) submissions(후보 이름)에 저장.
// 3) 만약 2)가 실패하면 1)에서 넣은 참여 기록을 되돌립니다.
//    (그래야 사용자가 다시 시도할 수 있습니다.)
//
// 돌려주는 값: { ok: true } 또는 { ok: false, reason: 'duplicate' | 'error' }
// ---------------------------------------------------------------
export async function submitIdeas({ personName, department, ideas }) {
  // ideas 예시: { main: ['하늘'], floor10: ['바다', '노을'], floor8: [] }
  const rows = []
  for (const groupKey of Object.keys(ideas)) {
    for (const name of ideas[groupKey]) {
      rows.push({ group_key: groupKey, name })
    }
  }
  if (rows.length === 0) return { ok: false, reason: 'empty' }

  // 1) 참여자 명단 등록 (중복 참여 차단)
  const { error: joinError } = await supabase.from('participants').insert({
    person_name: personName,
    department,
    phase: 'submission',
  })

  if (joinError) {
    // 23505 = 중복(unique) 위반 → 이미 공모에 참여한 사람
    if (joinError.code === '23505') return { ok: false, reason: 'duplicate' }
    console.error('참여자 등록 실패:', joinError)
    return { ok: false, reason: 'error' }
  }

  // 2) 후보 이름 저장
  const { error: ideaError } = await supabase.from('submissions').insert(rows)

  if (ideaError) {
    console.error('후보 저장 실패:', ideaError)
    // 3) 참여 기록 되돌리기 (다시 시도할 수 있게)
    await supabase.from('participants').delete().match({
      person_name: personName,
      department,
      phase: 'submission',
    })
    return { ok: false, reason: 'error' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------
// 지금까지 공모에 참여한 사람 수 (감사 화면에서 보여줄 용도)
// ---------------------------------------------------------------
export async function countSubmissionParticipants() {
  const { count, error } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('phase', 'submission')

  if (error) {
    console.error('참여자 수 조회 실패:', error)
    return null
  }
  return count
}
