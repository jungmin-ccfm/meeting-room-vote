// 4단계 — 공모 화면
// 직원이 이름·부서를 적고, 그룹별로 회의실 이름 후보를 제출하는 화면입니다.
// 제출이 끝나면 같은 화면에서 "감사 화면"으로 바뀝니다.
import { useEffect, useState } from 'react'
import { GROUPS } from '../lib/config'
import { submitIdeas, countSubmissionParticipants } from '../lib/db'

// 브라우저에 "이미 제출했음"을 기억시키는 열쇠 이름
const DONE_KEY = 'mrv_submission_done_v1'

// 입력값 정리: 앞뒤 공백 제거 + 중간 공백을 한 칸으로
function tidy(text) {
  return text.trim().replace(/\s+/g, ' ')
}

export default function SubmissionPage({ settings }) {
  // 화면 상태: 'form'(입력 중) → 'done'(제출 완료)
  const [view, setView] = useState('form')
  const [personName, setPersonName] = useState('')
  const [department, setDepartment] = useState('')

  // 그룹별 후보 입력칸. 예: { main: ['', ''], floor10: ['', ''], ... }
  const [ideas, setIdeas] = useState(() => {
    const initial = {}
    for (const group of GROUPS) initial[group.key] = Array(group.maxSubmit).fill('')
    return initial
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [participantCount, setParticipantCount] = useState(null)

  // 새로고침해도 제출 완료 화면이 유지되도록, 브라우저 기억을 확인합니다.
  useEffect(() => {
    if (localStorage.getItem(DONE_KEY)) setView('done')
  }, [])

  // 감사 화면에서 "지금까지 몇 명 참여했는지" 보여줍니다.
  useEffect(() => {
    if (view !== 'done') return
    let alive = true
    countSubmissionParticipants().then((count) => {
      if (alive) setParticipantCount(count)
    })
    return () => {
      alive = false
    }
  }, [view])

  function updateIdea(groupKey, index, value) {
    setIdeas((prev) => {
      const next = { ...prev, [groupKey]: [...prev[groupKey]] }
      next[groupKey][index] = value
      return next
    })
  }

  // 실제로 입력된(빈칸 아닌) 후보만 모아서 개수를 셉니다.
  const filledIdeas = {}
  let filledCount = 0
  for (const group of GROUPS) {
    const list = ideas[group.key].map(tidy).filter((name) => name.length > 0)
    filledIdeas[group.key] = list
    filledCount += list.length
  }

  const canSubmit =
    tidy(personName).length > 0 && tidy(department).length > 0 && filledCount > 0

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setErrorMsg('')

    const result = await submitIdeas({
      personName: tidy(personName),
      department: tidy(department),
      ideas: filledIdeas,
    })

    setSubmitting(false)

    if (result.ok) {
      localStorage.setItem(DONE_KEY, tidy(personName))
      setView('done')
      return
    }

    if (result.reason === 'duplicate') {
      setErrorMsg(
        '이미 공모에 참여하신 이름·부서입니다. 한 사람은 한 번만 제출할 수 있어요.',
      )
    } else {
      setErrorMsg('제출에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  // 공용 PC 등에서 다음 사람이 이어서 쓸 수 있도록 초기화
  function resetForNextPerson() {
    localStorage.removeItem(DONE_KEY)
    setPersonName('')
    setDepartment('')
    setIdeas(() => {
      const initial = {}
      for (const group of GROUPS) initial[group.key] = Array(group.maxSubmit).fill('')
      return initial
    })
    setErrorMsg('')
    setParticipantCount(null)
    setView('form')
  }

  // ------------------------------------------------------------
  // 제출 완료(감사) 화면
  // ------------------------------------------------------------
  if (view === 'done') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 text-5xl">🎉</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">제출 완료!</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          소중한 이름 후보를 보내주셔서 감사합니다.
          <br />
          공모가 마감되면 투표가 열립니다.
        </p>

        {participantCount !== null && (
          <div className="mt-6 rounded-2xl bg-white px-5 py-4 text-sm text-gray-500 shadow-sm">
            지금까지{' '}
            <span className="font-bold text-indigo-600">{participantCount}명</span>이
            참여했어요
          </div>
        )}

        <button
          type="button"
          onClick={resetForNextPerson}
          className="mt-8 text-xs text-gray-400 underline"
        >
          다른 사람이 이어서 제출하기
        </button>
      </div>
    )
  }

  // ------------------------------------------------------------
  // 입력 화면
  // ------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">회의실 이름 공모</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          우리 회의실 이름을 다 함께 정해요.
          <br />
          그룹마다 최대 {GROUPS[0].maxSubmit}개까지 제안할 수 있어요.
        </p>
      </div>

      {/* 참여자 정보 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-gray-800">참여자 정보</h2>
        <p className="mb-4 text-xs text-gray-400">
          중복 참여 확인용이며, 어떤 이름을 냈는지와 함께 공개되지 않습니다.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-gray-600">이름</span>
          <input
            type="text"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            maxLength={20}
            placeholder="예: 홍길동"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-600">부서</span>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={30}
            placeholder="예: 브랜드커뮤니케이션팀"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </section>

      {/* 그룹별 이름 후보 */}
      {GROUPS.map((group) => {
        const theme = settings?.[group.themeField]?.trim()
        return (
          <section key={group.key} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-800">{group.title}</h2>
              <span className="text-xs text-gray-400">최대 {group.maxSubmit}개</span>
            </div>

            {theme ? (
              <p className="mb-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-700">
                💡 {theme}
              </p>
            ) : (
              <p className="mb-4 text-xs text-gray-400">
                자유롭게 떠오르는 이름을 적어주세요.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {ideas[group.key].map((value, index) => (
                <input
                  key={index}
                  type="text"
                  value={value}
                  onChange={(e) => updateIdea(group.key, index, e.target.value)}
                  maxLength={20}
                  placeholder={`이름 후보 ${index + 1}`}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* 제출 버튼 (화면 아래에 항상 붙어 있음)
          안내/오류 문구도 이 안에 넣어야 버튼에 가려지지 않습니다. */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-[#f7f7fb]/90 px-5 pb-4 pt-2 backdrop-blur">
        {errorMsg && (
          <p className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600">
            {errorMsg}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full rounded-xl bg-indigo-500 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition disabled:bg-gray-300 disabled:shadow-none"
        >
          {submitting ? '제출 중...' : `제출하기 (후보 ${filledCount}개)`}
        </button>
        <p className="mt-2 text-center text-xs text-gray-400">
          제출 후에는 수정할 수 없습니다.
        </p>
      </div>
    </form>
  )
}
