// 투표 화면
//
// 설계 메모 (시뮬레이션에서 확인한 것들)
//  - 후보 순서를 모두에게 똑같이 보여주면 위쪽 이름이 몰표를 받습니다.
//    (위 15개만 보고 찍는 경우, 당선 이름의 80%가 상위 10칸에서 나왔습니다)
//    → 사람마다 순서를 무작위로 섞습니다. 새로고침해도 순서는 유지됩니다.
//  - 표를 너무 적게 주면 한 팀(10~15명)만 뭉쳐도 하위권 이름이 당선됩니다.
//    → 그룹당 표를 3~4개로 잡았습니다.
//  - 세 그룹을 모두 투표하도록 유도합니다. 특정 그룹 투표자가 적으면
//    그 그룹이 담합에 취약해집니다.
import { useEffect, useMemo, useState } from 'react'
import { GROUPS } from '../lib/config'
import { fetchSubmissions, submitVotes, countParticipants } from '../lib/db'
import { tidy, shuffleWithSeed } from '../lib/text'

const DONE_KEY = 'mrv_voting_done_v1'
const SEED_KEY = 'mrv_voting_seed_v1'

// 사람마다 다른 순서를 쓰되, 새로고침해도 같은 순서가 나오도록 seed 를 저장합니다.
function getSeed() {
  let s = localStorage.getItem(SEED_KEY)
  if (!s) {
    s = String(Math.floor(Math.random() * 2147483647))
    localStorage.setItem(SEED_KEY, s)
  }
  return Number(s)
}

export default function VotingPage() {
  const [view, setView] = useState('form')
  const [personName, setPersonName] = useState('')
  const [department, setDepartment] = useState('')
  const [candidates, setCandidates] = useState(null)
  const [picked, setPicked] = useState({}) // { groupKey: Set(id) }
  const [activeTab, setActiveTab] = useState(GROUPS[0].key)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [voterCount, setVoterCount] = useState(null)
  const seed = useMemo(getSeed, [])

  useEffect(() => {
    if (localStorage.getItem(DONE_KEY)) setView('done')
  }, [])

  useEffect(() => {
    let alive = true
    fetchSubmissions()
      .then((rows) => { if (alive) setCandidates(rows) })
      .catch((e) => {
        console.error('후보 조회 실패:', e)
        if (alive) setCandidates([])
      })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (view !== 'done') return
    let alive = true
    countParticipants('voting').then((c) => { if (alive) setVoterCount(c) })
    return () => { alive = false }
  }, [view])

  // 그룹별 후보를 사람마다 다른 순서로 섞어둡니다
  const shuffled = useMemo(() => {
    if (!candidates) return {}
    const out = {}
    GROUPS.forEach((g, gi) => {
      const list = candidates.filter((c) => c.group_key === g.key)
      out[g.key] = shuffleWithSeed(list, seed + gi * 7919)
    })
    return out
  }, [candidates, seed])

  function toggle(groupKey, id, maxVote) {
    setPicked((prev) => {
      const set = new Set(prev[groupKey] ?? [])
      if (set.has(id)) set.delete(id)
      else {
        if (set.size >= maxVote) return prev // 정해진 개수를 넘으면 무시
        set.add(id)
      }
      return { ...prev, [groupKey]: set }
    })
  }

  const countOf = (key) => (picked[key]?.size ?? 0)
  const totalPicked = GROUPS.reduce((s, g) => s + countOf(g.key), 0)
  const allGroupsDone = GROUPS.every((g) => countOf(g.key) > 0)
  const canSubmit =
    tidy(personName).length > 0 && tidy(department).length > 0 && allGroupsDone && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg('')

    const ids = GROUPS.flatMap((g) => [...(picked[g.key] ?? [])])
    const result = await submitVotes({ personName, department, submissionIds: ids })
    setSubmitting(false)

    if (result.ok) {
      localStorage.setItem(DONE_KEY, tidy(personName))
      setView('done')
      return
    }
    if (result.reason === 'duplicate') {
      setErrorMsg('이미 투표하신 이름·부서입니다. 투표는 한 번만 가능합니다.')
    } else {
      setErrorMsg('투표에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  function resetForNextPerson() {
    localStorage.removeItem(DONE_KEY)
    localStorage.removeItem(SEED_KEY)
    setPersonName(''); setDepartment(''); setPicked({})
    setActiveTab(GROUPS[0].key); setErrorMsg(''); setVoterCount(null); setView('form')
  }

  // ------------------------------------------------------------
  if (view === 'done') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 text-5xl">🗳️</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">투표 완료!</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          참여해 주셔서 감사합니다.
          <br />
          결과는 투표가 마감된 후 공개됩니다.
        </p>
        {voterCount !== null && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 text-sm text-gray-500 shadow-sm">
            지금까지 <span className="font-bold text-indigo-600">{voterCount}명</span>이 투표했어요
          </div>
        )}
        <p className="mt-6 text-xs leading-relaxed text-gray-400">
          득표수는 투표가 진행되는 동안 공개되지 않습니다.
        </p>
        <button type="button" onClick={resetForNextPerson} className="mt-8 text-xs text-gray-400 underline">
          다른 사람이 이어서 투표하기
        </button>
      </div>
    )
  }

  if (!candidates) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">후보를 불러오는 중...</p>
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-3 text-4xl">🤔</div>
        <p className="text-sm text-gray-500">아직 후보가 없습니다.</p>
      </div>
    )
  }

  const group = GROUPS.find((g) => g.key === activeTab)
  const list = shuffled[activeTab] ?? []
  const pickedHere = picked[activeTab] ?? new Set()

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">회의실 이름 투표</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          세 곳 모두 투표해 주세요. 2~3분이면 끝납니다.
        </p>
      </div>

      {/* 참여자 정보 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
            maxLength={20} placeholder="이름"
            className="w-1/3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <input
            type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
            maxLength={30} placeholder="부서"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          중복 투표 확인용입니다. <b>누가 어떤 이름에 투표했는지는 저장되지 않습니다.</b>
        </p>
      </section>

      {/* 그룹 탭 */}
      <div className="flex gap-1.5">
        {GROUPS.map((g) => {
          const done = countOf(g.key) > 0
          const active = g.key === activeTab
          return (
            <button
              key={g.key} type="button" onClick={() => setActiveTab(g.key)}
              className={
                'flex-1 rounded-xl px-2 py-2.5 text-xs font-bold transition ' +
                (active
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                  : done
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-white text-gray-400 shadow-sm')
              }
            >
              {done && !active && '✓ '}
              {g.title}
              <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                {countOf(g.key)}/{g.maxVote}
              </span>
            </button>
          )
        })}
      </div>

      {/* 후보 목록 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-800">{group.title}</h2>
          <span className="text-xs font-semibold text-indigo-600">
            {pickedHere.size} / {group.maxVote} 선택
          </span>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          마음에 드는 이름을 <b>최대 {group.maxVote}개</b>까지 골라주세요. (후보 {list.length}개)
        </p>

        <div className="flex flex-wrap gap-2">
          {list.map((c) => {
            const on = pickedHere.has(c.id)
            const full = pickedHere.size >= group.maxVote && !on
            return (
              <button
                key={c.id} type="button"
                onClick={() => toggle(group.key, c.id, group.maxVote)}
                disabled={full}
                className={
                  'rounded-full border px-3.5 py-2 text-sm transition ' +
                  (on
                    ? 'border-indigo-500 bg-indigo-500 font-bold text-white shadow-sm'
                    : full
                      ? 'border-gray-100 bg-gray-50 text-gray-300'
                      : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50')
                }
              >
                {on && '✓ '}
                {c.name}
              </button>
            )
          })}
        </div>

        {pickedHere.size >= group.maxVote && (
          <p className="mt-3 text-xs text-gray-400">
            {group.maxVote}개를 다 고르셨어요. 바꾸려면 선택한 이름을 다시 누르세요.
          </p>
        )}
      </section>

      {/* 제출 */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-[#f7f7fb]/90 px-5 pb-4 pt-2 backdrop-blur">
        {errorMsg && (
          <p className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600">
            {errorMsg}
          </p>
        )}
        {!allGroupsDone && !errorMsg && (
          <p className="mb-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-700">
            아직 고르지 않은 곳이 있어요:{' '}
            <b>{GROUPS.filter((g) => countOf(g.key) === 0).map((g) => g.title).join(', ')}</b>
          </p>
        )}
        <button
          type="submit" disabled={!canSubmit}
          className="w-full rounded-xl bg-indigo-500 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition disabled:bg-gray-300 disabled:shadow-none"
        >
          {submitting ? '제출 중...' : `투표하기 (${totalPicked}개 선택)`}
        </button>
        <p className="mt-2 text-center text-xs text-gray-400">
          투표는 <b>한 번만</b> 가능하며, 제출 후 수정할 수 없습니다.
        </p>
      </div>
    </form>
  )
}
