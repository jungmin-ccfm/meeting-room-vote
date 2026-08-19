// 데이터 창고(Supabase)와 실제로 이야기하는 함수들을 모아둔 곳.
// 화면 파일(App.jsx, pages/*)에서는 여기 함수만 부르면 됩니다.
import { supabase } from './supabase'
import { GROUPS, getGroup } from './config'
import { tidy } from './text'

// ---------------------------------------------------------------
// 설정 (현재 단계 phase + 그룹별 안내문)
// ---------------------------------------------------------------
export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updatePhase(phase) {
  const { error } = await supabase.from('settings').update({ phase }).eq('id', 1)
  if (error) throw error
}

export async function updateNotes(notes) {
  const { error } = await supabase.from('settings').update(notes).eq('id', 1)
  if (error) throw error
}

// ---------------------------------------------------------------
// 후보 이름 목록
//   includeHidden=false → 투표 대상(status='ok')만
//   includeHidden=true  → 보류·삭제까지 전부 (관리자 화면용)
// ---------------------------------------------------------------
export async function fetchSubmissions({ includeHidden = false } = {}) {
  let q = supabase
    .from('submissions')
    .select('id, group_key, name, status, created_at')
    .order('created_at', { ascending: true })

  if (!includeHidden) q = q.eq('status', 'ok')

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function countSubmissions() {
  const { count, error } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ok')
  if (error) { console.error(error); return null }
  return count
}

// ---------------------------------------------------------------
// 이름 후보 제출
//
// 순서가 중요합니다.
// 1) participants 에 먼저 등록 → 같은 (이름, 부서)가 이미 있으면
//    데이터베이스가 거절하므로 "중복 참여"를 여기서 걸러냅니다.
// 2) submissions 에 후보 저장 (status: 'ok' 또는 'pending')
// 3) submission_authors 에 "누가 냈는지" 저장 (관리자만 확인 가능)
// 4) 중간에 실패하면 1)을 되돌려 다시 시도할 수 있게 합니다.
//
// items: [{ groupKey, name, status }]
// 돌려주는 값: { ok: true } | { ok: false, reason: 'duplicate'|'empty'|'error' }
// ---------------------------------------------------------------
export async function submitIdeas({ personName, department, items }) {
  if (!items?.length) return { ok: false, reason: 'empty' }

  const person = tidy(personName)
  const dept = tidy(department)

  // 1) 참여자 명단 등록 (중복 참여 차단)
  const { error: joinError } = await supabase
    .from('participants')
    .insert({ person_name: person, department: dept, phase: 'submission' })

  if (joinError) {
    if (joinError.code === '23505') return { ok: false, reason: 'duplicate' }
    console.error('참여자 등록 실패:', joinError)
    return { ok: false, reason: 'error' }
  }

  const rollback = async () => {
    await supabase
      .from('participants')
      .delete()
      .match({ person_name: person, department: dept, phase: 'submission' })
  }

  // 2) 후보 저장 (저장된 id 를 돌려받아야 하므로 select())
  const rows = items.map((it) => ({
    group_key: it.groupKey,
    name: tidy(it.name),
    status: it.status,
  }))

  const { data: saved, error: ideaError } = await supabase
    .from('submissions')
    .insert(rows)
    .select('id')

  if (ideaError) {
    console.error('후보 저장 실패:', ideaError)
    await rollback()
    return { ok: false, reason: 'error' }
  }

  // 3) 제출자 기록 (실패해도 제출 자체는 살린다 — 기록은 부가 정보)
  const authorRows = saved.map((s) => ({
    submission_id: s.id,
    person_name: person,
    department: dept,
  }))
  const { error: authorError } = await supabase.from('submission_authors').insert(authorRows)
  if (authorError) console.error('제출자 기록 실패(제출은 완료됨):', authorError)

  return { ok: true }
}

// ---------------------------------------------------------------
// 투표
//   votes 에는 submission_id 만 넣습니다. 누가 찍었는지는 저장하지 않습니다.
//   참여 사실만 participants(phase='voting')에 따로 남깁니다.
//   두 표는 서로 연결되지 않으므로 투표는 완전 익명입니다.
// ---------------------------------------------------------------
export async function submitVotes({ personName, department, submissionIds }) {
  if (!submissionIds?.length) return { ok: false, reason: 'empty' }

  const person = tidy(personName)
  const dept = tidy(department)

  const { error: joinError } = await supabase
    .from('participants')
    .insert({ person_name: person, department: dept, phase: 'voting' })

  if (joinError) {
    if (joinError.code === '23505') return { ok: false, reason: 'duplicate' }
    console.error('투표자 등록 실패:', joinError)
    return { ok: false, reason: 'error' }
  }

  const { error: voteError } = await supabase
    .from('votes')
    .insert(submissionIds.map((id) => ({ submission_id: id })))

  if (voteError) {
    console.error('투표 저장 실패:', voteError)
    await supabase
      .from('participants')
      .delete()
      .match({ person_name: person, department: dept, phase: 'voting' })
    return { ok: false, reason: 'error' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------
// 참여 현황 (몇 명 참여했는지. 득표수와는 무관하므로 언제든 공개 가능)
// ---------------------------------------------------------------
// 브라우저에 남은 "참여 완료" 표시가 서버 기록과 맞는지 확인용.
// 서버 데이터가 초기화되어 기록이 없으면 false. 오류면 null(판단 보류).
export async function hasParticipant(personName, phase) {
  const { count, error } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('person_name', tidy(personName))
    .eq('phase', phase)
  if (error) { console.error(error); return null }
  return count > 0
}

export async function countParticipants(phase) {
  const { count, error } = await supabase
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('phase', phase)
  if (error) { console.error(error); return null }
  return count
}

export async function fetchParticipants(phase) {
  const { data, error } = await supabase
    .from('participants')
    .select('person_name, department, created_at')
    .eq('phase', phase)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ---------------------------------------------------------------
// 결과 집계
//   votes 는 RLS 때문에 phase='result' 일 때만 읽힙니다.
//   (투표 중에는 관리자도 득표수를 볼 수 없습니다 — 의도된 설계)
//
//   동표는 "먼저 제출된 이름"이 앞섭니다. 이 규칙은 공지에 미리 넣습니다.
// ---------------------------------------------------------------
export async function fetchResults() {
  const [subs, votesRes] = await Promise.all([
    fetchSubmissions(),
    supabase.from('votes').select('submission_id'),
  ])

  if (votesRes.error) throw votesRes.error

  const tally = new Map()
  for (const v of votesRes.data) {
    tally.set(v.submission_id, (tally.get(v.submission_id) || 0) + 1)
  }

  const byGroup = {}
  for (const g of GROUPS) {
    const ranked = subs
      .filter((s) => s.group_key === g.key)
      .map((s) => ({ ...s, votes: tally.get(s.id) || 0 }))
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes
        return new Date(a.created_at) - new Date(b.created_at) // 동표 → 먼저 제출
      })

    byGroup[g.key] = {
      winners: ranked.slice(0, g.pick),
      totalCandidates: ranked.length,
    }
  }
  return byGroup
}

// ---------------------------------------------------------------
// 회의실 / 방 배정
// ---------------------------------------------------------------
export async function fetchRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('group_key')
    .order('sort_order')
  if (error) throw error
  return data
}

// 뽑힌 이름을 같은 그룹의 방에 무작위로 배정한다.
// (같은 층 안에서는 방 용도가 비슷하므로 무작위가 가장 깔끔하다)
export async function assignRoomsRandomly() {
  const [rooms, results] = await Promise.all([fetchRooms(), fetchResults()])

  const updates = []
  for (const g of GROUPS) {
    const groupRooms = rooms.filter((r) => r.group_key === g.key)
    const names = results[g.key].winners.map((w) => w.name)

    // 이름 순서를 섞는다
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[names[i], names[j]] = [names[j], names[i]]
    }
    groupRooms.forEach((room, i) => {
      updates.push({ id: room.id, assigned_name: names[i] ?? null })
    })
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('rooms')
      .update({ assigned_name: u.assigned_name })
      .eq('id', u.id)
    if (error) throw error
  }
  return updates.length
}

// ---------------------------------------------------------------
// 관리자: 후보 상태 바꾸기 (보류 승인 / 삭제 / 되살리기)
// ---------------------------------------------------------------
export async function setSubmissionStatus(id, status) {
  const { error } = await supabase.from('submissions').update({ status }).eq('id', id)
  if (error) throw error
}

// 그룹별 후보 개수 (관리자 현황판용)
export function groupCounts(subs) {
  const out = {}
  for (const g of GROUPS) {
    const list = subs.filter((s) => s.group_key === g.key)
    out[g.key] = {
      ok: list.filter((s) => s.status === 'ok').length,
      pending: list.filter((s) => s.status === 'pending').length,
      removed: list.filter((s) => s.status === 'removed').length,
    }
  }
  return out
}

export { getGroup }
