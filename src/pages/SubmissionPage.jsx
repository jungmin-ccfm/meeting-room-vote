// 공모 화면
// 직원이 이름·부서를 적고, 그룹별로 회의실 이름 후보를 제출합니다.
//
// 설계 메모
//  - 다른 사람이 낸 이름 목록은 보여주지 않습니다.
//    (남의 이름에 휩쓸리거나, 먼저 낸 이름이 유리해지는 걸 막기 위함)
//  - 대신 입력할 때 "완전히 같은 이름"은 막고, "비슷한 이름"은 알려만 줍니다.
//    비슷한 걸 합칠지 말지는 담당자가 아니라 낸 사람이 정합니다.
//  - 금칙어·직급 단어가 들어가면 바로 공개되지 않고 담당자 확인을 기다립니다.
import { useEffect, useMemo, useState } from 'react'
import { GROUPS, NAME_MAX, isKiosk } from '../lib/config'
import { submitIdeas, countParticipants, countSubmissions, fetchSubmissions, hasParticipant } from '../lib/db'
import { tidy, normalize, findLookalikes, screenName } from '../lib/text'

const DONE_KEY = 'mrv_submission_done_v2'

const emptyIdeas = () => {
  const o = {}
  for (const g of GROUPS) o[g.key] = Array(g.maxSubmit).fill('')
  return o
}

export default function SubmissionPage({ settings }) {
  const [view, setView] = useState('form')
  const [personName, setPersonName] = useState('')
  const [department, setDepartment] = useState('')
  const [ideas, setIdeas] = useState(emptyIdeas)

  const [existing, setExisting] = useState([]) // 이미 등록된 이름들 (중복·유사 검사용)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [peopleCount, setPeopleCount] = useState(null)
  const [nameCount, setNameCount] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(DONE_KEY)
    if (!saved) return
    setView('done')
    // 서버 데이터가 초기화됐는데 이 브라우저에만 완료 표시가 남았으면 자동 해제
    hasParticipant(saved, 'submission').then((exists) => {
      if (exists === false) {
        localStorage.removeItem(DONE_KEY)
        setView('form')
      }
    })
  }, [])

  // 중복·유사 검사에 쓸 기존 이름 목록을 미리 받아둡니다.
  // (화면에 목록을 보여주지는 않습니다)
  useEffect(() => {
    let alive = true
    fetchSubmissions({ includeHidden: true })
      .then((rows) => { if (alive) setExisting(rows) })
      .catch((e) => console.error('기존 이름 조회 실패:', e))
    countSubmissions().then((c) => { if (alive) setNameCount(c) })
    return () => { alive = false }
  }, [view])

  useEffect(() => {
    if (view !== 'done') return
    let alive = true
    countParticipants('submission').then((c) => { if (alive) setPeopleCount(c) })
    return () => { alive = false }
  }, [view])

  function updateIdea(groupKey, index, value) {
    setIdeas((prev) => {
      const next = { ...prev, [groupKey]: [...prev[groupKey]] }
      next[groupKey][index] = value
      return next
    })
  }

  // 입력칸마다 실시간 검사 결과를 계산합니다.
  const checks = useMemo(() => {
    const out = {}
    for (const g of GROUPS) {
      const groupExisting = existing.filter((s) => s.group_key === g.key).map((s) => s.name)
      out[g.key] = ideas[g.key].map((raw, i) => {
        const name = tidy(raw)
        if (!name) return null

        // 같은 화면에서 내가 두 칸에 같은 이름을 쓴 경우
        const selfDup = ideas[g.key].some(
          (other, j) => j !== i && normalize(other) === normalize(name) && normalize(name),
        )
        if (selfDup) return { level: 'error', text: '같은 이름을 두 번 적으셨어요.' }

        const screen = screenName(name)
        if (!screen.ok) return { level: 'error', text: screen.reason }

        const { exact, similar } = findLookalikes(name, groupExisting)
        if (exact) {
          return { level: 'error', text: `"${exact}"은(는) 이미 등록된 이름이에요.` }
        }
        if (similar.length) {
          return {
            level: 'warn',
            text: `비슷한 이름이 이미 있어요: ${similar.join(', ')} — 그래도 괜찮으면 그대로 두세요.`,
            status: screen.status,
          }
        }
        if (screen.status === 'pending') return { level: 'warn', text: screen.reason, status: 'pending' }
        return { level: 'ok', text: '', status: 'ok' }
      })
    }
    return out
  }, [ideas, existing])

  // 제출할 항목 모으기
  const items = []
  let hasError = false
  for (const g of GROUPS) {
    ideas[g.key].forEach((raw, i) => {
      const name = tidy(raw)
      const c = checks[g.key][i]
      if (!name) return
      if (c?.level === 'error') { hasError = true; return }
      items.push({ groupKey: g.key, name, status: c?.status === 'pending' ? 'pending' : 'ok' })
    })
  }

  const canSubmit =
    tidy(personName).length > 0 && tidy(department).length > 0 && items.length > 0 && !hasError

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setErrorMsg('')

    const result = await submitIdeas({ personName, department, items })
    setSubmitting(false)

    if (result.ok) {
      localStorage.setItem(DONE_KEY, tidy(personName))
      setView('done')
      return
    }
    if (result.reason === 'duplicate') {
      setErrorMsg('이미 공모에 참여하신 이름·부서입니다. 한 사람은 한 번만 제출할 수 있어요.')
    } else {
      setErrorMsg('제출에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  function resetForNextPerson() {
    localStorage.removeItem(DONE_KEY)
    setPersonName(''); setDepartment(''); setIdeas(emptyIdeas())
    setErrorMsg(''); setPeopleCount(null); setView('form')
  }

  // ------------------------------------------------------------
  // 제출 완료 화면
  // ------------------------------------------------------------
  if (view === 'done') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="mb-4 text-5xl">🎉</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">제출 완료!</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          소중한 이름을 보내주셔서 감사합니다.
          <br />
          공모가 마감되면 <b className="text-gray-700">본투표</b>가 열립니다.
        </p>

        <div className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm text-gray-500 shadow-sm">
          {peopleCount !== null && (
            <p>
              지금까지 <span className="font-bold text-indigo-600">{peopleCount}명</span>이 참여했어요
            </p>
          )}
          {nameCount !== null && (
            <p className="mt-1 text-xs text-gray-400">모인 이름 {nameCount}개</p>
          )}
        </div>

        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
          📢 투표는 <b>따로 진행됩니다.</b> 오늘 참여하셨더라도
          <br />
          투표 안내가 오면 한 번 더 참여해 주세요!
        </p>

        {isKiosk() && (
          <button
            type="button"
            onClick={resetForNextPerson}
            className="mt-8 text-xs text-gray-400 underline"
          >
            다른 사람이 이어서 제출하기
          </button>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------
  // 입력 화면
  // ------------------------------------------------------------
  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-800">우리 회의실 이름을 정합니다</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          여기서 정해진 이름이 <b className="text-gray-700">실제 회의실 문에 붙습니다.</b>
          <br />
          매일 부르고, 손님을 모실 때 안내하는 이름입니다.
        </p>
      </div>

      {/* 안내 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3">
          <p className="mb-1 text-sm font-bold text-gray-700">이런 이름이 좋아요</p>
          <ul className="space-y-0.5 text-xs leading-relaxed text-gray-500">
            <li>· 소리 내어 부르기 쉬운 이름</li>
            <li>· 처음 온 손님도 알아들을 수 있는 이름</li>
            <li>· 몇 년 뒤에도 안 어색한 이름</li>
          </ul>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-sm font-bold text-gray-700">이런 이름은 피해주세요</p>
          <ul className="space-y-0.5 text-xs leading-relaxed text-gray-500">
            <li>· 특정 사람이나 팀을 가리키는 이름</li>
            <li>· 줄임말, 유행어</li>
          </ul>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="mb-1 text-xs font-bold text-gray-600">📋 제출된 이름은 검토 후 후보에 올라가요</p>
          <ul className="space-y-0.5 text-[11px] leading-relaxed text-gray-500">
            <li>· 오타, 초성, 장난 이름은 후보에서 제외될 수 있어요.</li>
            <li>· 전 직원과 손님이 함께 쓰는 공간인 만큼, 어울리지 않는 표현도 제외될 수 있어요.</li>
            <li>· 비슷한 이름이 여럿 들어오면 하나로 합쳐질 수 있어요.</li>
          </ul>
        </div>
      </section>

      {/* 참여자 정보 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-gray-800">참여자 정보</h2>
        <p className="mb-4 text-xs leading-relaxed text-gray-400">
          제출하신 이름은 <b>담당자만 확인</b>하며, 사내에는 공개되지 않습니다.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-semibold text-gray-600">이름</span>
          <input
            type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
            maxLength={20} placeholder="예: 홍길동"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-600">부서</span>
          <input
            type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
            maxLength={30} placeholder="예: 마케팅사업부 1본부 5팀"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </section>

      {/* 그룹별 이름 후보 */}
      {GROUPS.map((group) => {
        const note = settings?.[group.themeField]?.trim() || group.defaultNote
        return (
          <section key={group.key} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-800">{group.title}</h2>
              <span className="text-xs text-gray-400">
                방 {group.pick}개 · 최대 {group.maxSubmit}개 제안
              </span>
            </div>

            {/* 공간 사진 — public/rooms/{키}.jpg 파일이 있을 때만 보입니다 */}
            <img
              src={`/rooms/${group.key}.jpg`}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none' }}
              className="mb-3 h-36 w-full rounded-xl object-cover"
            />

            <p className="mb-4 rounded-xl bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-700">
              💡 {note}
            </p>

            <div className="flex flex-col gap-3">
              {ideas[group.key].map((value, index) => {
                const c = checks[group.key][index]
                const border =
                  c?.level === 'error' ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : c?.level === 'warn' ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-100'
                  : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-100'
                return (
                  <div key={index}>
                    <input
                      type="text" value={value}
                      onChange={(e) => updateIdea(group.key, index, e.target.value)}
                      maxLength={NAME_MAX}
                      placeholder={group.maxSubmit > 1 ? `이름 후보 ${index + 1}` : '이름 후보'}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 ${border}`}
                    />
                    {c?.text && (
                      <p
                        className={
                          'mt-1.5 px-1 text-xs leading-relaxed ' +
                          (c.level === 'error' ? 'text-red-500' : 'text-amber-600')
                        }
                      >
                        {c.level === 'error' ? '⚠ ' : '💬 '}
                        {c.text}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* 제출 버튼 (안내·오류 문구도 이 안에 넣어야 버튼에 가려지지 않습니다) */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-[#f7f7fb]/90 px-5 pb-4 pt-2 backdrop-blur">
        {errorMsg && (
          <p className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-600">
            {errorMsg}
          </p>
        )}
        {hasError && !errorMsg && (
          <p className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-600">
            빨간 표시가 있는 칸을 고쳐주세요.
          </p>
        )}
        <button
          type="submit" disabled={!canSubmit || submitting}
          className="w-full rounded-xl bg-indigo-500 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition disabled:bg-gray-300 disabled:shadow-none"
        >
          {submitting ? '제출 중...' : `제출하기 (이름 ${items.length}개)`}
        </button>
        <p className="mt-2 text-center text-xs text-gray-400">제출 후에는 수정할 수 없습니다.</p>
      </div>
    </form>
  )
}
