// 관리자 화면 (/admin)
//
// 공모가 열려 있는 동안 여기를 켜두면 됩니다.
//  - 보류함: 금칙어·직급 단어 등이 걸린 이름이 여기 쌓입니다. 공개/삭제를 고릅니다.
//  - 전체 목록: 통과된 이름도 이상한 게 보이면 바로 내릴 수 있습니다.
//  - 단계 전환: 공모 → 마감 → 투표 → 결과
//
// 보안에 대해: 이 앱은 브라우저에서 직접 DB에 접속하는 구조라, 비밀번호 확인도
// 브라우저에서 합니다. 사내 이벤트 수준에서는 충분하지만 완벽한 잠금은 아닙니다.
// "누가 어떤 이름을 냈는지"는 Supabase 대시보드에서만 볼 수 있게 따로 막아뒀습니다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { GROUPS, NAME_MAX } from '../lib/config'
import { tidy, normalize } from '../lib/text'
import {
  fetchSettings, updatePhase, updateNotes,
  fetchSubmissions, setSubmissionStatus, groupCounts, addSubmission,
  countParticipants, fetchParticipants, assignRoomsRandomly, fetchRooms,
} from '../lib/db'

const PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin'
const AUTH_KEY = 'mrv_admin_ok_v1'

const PHASES = [
  { key: 'submission', label: '공모 중', desc: '직원들이 이름을 제출할 수 있습니다' },
  { key: 'review', label: '공모 마감', desc: '제출은 막히고, 투표는 아직 안 열립니다' },
  { key: 'voting', label: '투표 중', desc: '후보 전체를 보고 투표합니다' },
  { key: 'result', label: '결과 공개', desc: '득표수와 선정 결과가 공개됩니다' },
]

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState('')

  const [settings, setSettings] = useState(null)
  const [subs, setSubs] = useState([])
  const [counts, setCounts] = useState({ submission: null, voting: null })
  const [people, setPeople] = useState([])
  const [rooms, setRooms] = useState([])
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState({})
  const [notesSaved, setNotesSaved] = useState(false)
  // 안내문을 입력하는 중에는 10초 자동 새로고침이 입력을 덮어쓰지 않게 합니다
  const notesDirtyRef = useRef(false)
  const [subsError, setSubsError] = useState('')
  const [actError, setActError] = useState('')

  // 누락 후보 직접 추가
  const [addName, setAddName] = useState('')
  const [addGroup, setAddGroup] = useState(GROUPS[0].key)

  // 되돌리기 어려운 버튼은 팝업 대신 "두 번 누르기"로 확인받습니다.
  // (팝업은 휴대폰에서 투박하고, 잘못 누르면 되돌릴 수 없어서)
  const [armed, setArmed] = useState(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 8000)
    return () => clearTimeout(t)
  }, [armed])
  // 첫 클릭이면 true 를 돌려주고(=아직 실행 안 함), 두 번째 클릭이면 false
  const needsConfirm = (key) => {
    if (armed === key) { setArmed(null); return false }
    setArmed(key)
    return true
  }

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY)) setAuthed(true)
  }, [])

  // 하나가 실패해도 나머지는 보이게 합니다.
  // (예: DB에 아직 status 컬럼이 없으면 이름 목록만 비고 단계 전환은 됩니다)
  const reload = useCallback(async () => {
    const [s, all, c1, c2, rm] = await Promise.allSettled([
      fetchSettings(),
      fetchSubmissions({ includeHidden: true }),
      countParticipants('submission'),
      countParticipants('voting'),
      fetchRooms(),
    ])

    if (s.status === 'fulfilled') {
      setSettings(s.value)
      if (!notesDirtyRef.current) {
        setNotes({
          theme_main: s.value.theme_main ?? '',
          theme_floor10: s.value.theme_floor10 ?? '',
          theme_floor8: s.value.theme_floor8 ?? '',
        })
      }
    } else {
      console.error('설정 조회 실패:', s.reason)
    }

    if (all.status === 'fulfilled') {
      setSubs(all.value)
      setSubsError('')
    } else {
      console.error('이름 목록 조회 실패:', all.reason)
      setSubsError(
        'DB 설정이 아직 안 끝났습니다. supabase_setup_2.sql 을 Supabase에서 실행해 주세요.',
      )
    }

    setCounts({
      submission: c1.status === 'fulfilled' ? c1.value : null,
      voting: c2.status === 'fulfilled' ? c2.value : null,
    })
    if (rm.status === 'fulfilled') setRooms(rm.value)
  }, [])

  useEffect(() => {
    if (!authed) return
    reload()
    // 보류함을 놓치지 않도록 10초마다 새로 읽습니다
    const timer = setInterval(reload, 10000)
    return () => clearInterval(timer)
  }, [authed, reload])

  // 보류 건이 새로 생기면 탭 제목에 표시 + 소리로 알림
  const pending = subs.filter((s) => s.status === 'pending')
  useEffect(() => {
    if (!authed) return
    document.title = pending.length ? `(${pending.length}) 관리자` : '관리자'
  }, [pending.length, authed])

  function login(e) {
    e.preventDefault()
    if (pw === PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1')
      setAuthed(true)
    } else {
      setPwError('비밀번호가 맞지 않습니다.')
    }
  }

  // "제출했는데 이름이 없어요" 제보를 받았을 때 관리자가 직접 추가합니다.
  // 지워진 것까지 포함해 같은 이름이 이미 있으면 막고 어디 있는지 알려줍니다.
  async function addCandidate() {
    const name = tidy(addName)
    if (!name) return
    const dup = subs.find(
      (s) => s.group_key === addGroup && normalize(s.name) === normalize(name),
    )
    if (dup) {
      const where = dup.status === 'ok' ? '후보 목록' : dup.status === 'pending' ? '보류함' : '삭제 목록'
      setActError(`"${dup.name}" — 이미 ${where}에 같은 이름이 있어요. (삭제된 거라면 목록에서 "공개"로 되살리세요)`)
      return
    }
    await act(() => addSubmission({ groupKey: addGroup, name }), 'add')
    setAddName('')
  }

  async function act(fn, label) {
    setBusy(label)
    setActError('')
    try { await fn(); await reload() }
    catch (e) {
      console.error(e)
      setActError('처리에 실패했습니다: ' + (e.message ?? e))
    }
    finally { setBusy('') }
  }

  // ------------------------------------------------------------
  if (!authed) {
    return (
      <form onSubmit={login} className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="mb-2 text-4xl">🔐</div>
        <h1 className="text-lg font-bold text-gray-800">관리자</h1>
        <input
          type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호" autoFocus
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        {pwError && <p className="text-xs text-red-500">{pwError}</p>}
        <button type="submit" className="w-full rounded-xl bg-gray-800 py-3 text-sm font-bold text-white">
          들어가기
        </button>
        <a href="/" className="mt-2 text-xs text-gray-400 underline">일반 화면으로</a>
      </form>
    )
  }

  if (!settings) {
    return <div className="flex flex-1 items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  const gc = groupCounts(subs)
  const okList = subs.filter((s) => s.status === 'ok')
  const removedList = subs.filter((s) => s.status === 'removed')
  const shown = tab === 'pending' ? pending : tab === 'ok' ? okList : removedList

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-gray-800">관리자</h1>
        <a href="/" className="text-xs text-gray-400 underline">일반 화면</a>
      </div>

      {actError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-600">
          ⚠ {actError}
        </p>
      )}

      {/* 현재 단계 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold text-gray-500">진행 단계</p>
        <div className="grid grid-cols-2 gap-2">
          {PHASES.map((p) => {
            const active = settings.phase === p.key
            const isArmed = armed === 'phase:' + p.key
            return (
              <button
                key={p.key} type="button"
                disabled={active || busy === 'phase'}
                onClick={() => {
                  if (needsConfirm('phase:' + p.key)) return
                  act(() => updatePhase(p.key), 'phase')
                }}
                className={
                  'rounded-xl px-3 py-2.5 text-left text-xs transition ' +
                  (active
                    ? 'bg-indigo-500 font-bold text-white'
                    : isArmed
                      ? 'bg-amber-400 font-bold text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100')
                }
              >
                <span className="block font-bold">
                  {isArmed ? '한 번 더 누르면 변경' : p.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-tight opacity-70">
                  {isArmed ? `"${p.label}" 단계로 바꿉니다` : p.desc}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 현황 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold text-gray-500">현황</p>
        <div className="mb-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-gray-50 py-2.5">
            <p className="text-lg font-bold text-gray-800">{counts.submission ?? '-'}</p>
            <p className="text-[10px] text-gray-400">공모 참여자</p>
          </div>
          <div className="rounded-xl bg-gray-50 py-2.5">
            <p className="text-lg font-bold text-gray-800">{counts.voting ?? '-'}</p>
            <p className="text-[10px] text-gray-400">투표 참여자</p>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left font-medium">그룹</th>
              <th className="font-medium">후보</th>
              <th className="font-medium">보류</th>
              <th className="font-medium">삭제</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => {
              // 후보가 방 개수(pick)보다 적으면 결과 발표 때 이름 없는 방이 생깁니다
              const short = gc[g.key].ok < g.pick
              return (
                <tr key={g.key} className="border-t border-gray-100">
                  <td className="py-1.5 text-gray-600">{g.title}</td>
                  <td className={'text-center font-bold ' + (short ? 'text-red-500' : 'text-gray-800')}>
                    {short && '⚠ '}{gc[g.key].ok}
                    <span className="ml-0.5 font-medium text-gray-300">/{g.pick}</span>
                  </td>
                  <td className={'text-center font-bold ' + (gc[g.key].pending ? 'text-amber-600' : 'text-gray-300')}>
                    {gc[g.key].pending}
                  </td>
                  <td className="text-center text-gray-300">{gc[g.key].removed}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {GROUPS.some((g) => gc[g.key].ok < g.pick) && settings?.phase !== 'result' && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-600">
            ⚠ <b>후보가 방 개수보다 적은 그룹이 있어요.</b> 이대로 결과를 공개하면 이름 없는
            방이 생깁니다. 공모 마감을 미루고 참여를 독려하거나, 후보를 더 모아주세요.
          </p>
        )}
      </section>

      {/* 이름 관리 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        {/* 누락 후보 직접 추가 — "제출했는데 없어요" 제보 대응용 */}
        <div className="mb-3 rounded-xl bg-indigo-50/60 p-3">
          <p className="mb-2 text-[11px] font-bold text-gray-600">
            ➕ 후보 직접 추가
            <span className="ml-1 font-medium text-gray-400">누락 제보를 받았을 때</span>
          </p>
          <div className="mb-2 flex gap-1.5">
            {GROUPS.map((g) => (
              <button
                key={g.key} type="button" onClick={() => setAddGroup(g.key)}
                className={
                  'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition ' +
                  (addGroup === g.key ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500')
                }
              >
                {g.title}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={addName} maxLength={NAME_MAX}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCandidate() } }}
              placeholder="추가할 이름"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="button" disabled={!tidy(addName) || busy === 'add'}
              onClick={addCandidate}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white disabled:bg-gray-300"
            >
              {busy === 'add' ? '추가 중...' : '추가'}
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-1.5">
          {[
            { key: 'pending', label: `보류 ${pending.length}`, warn: pending.length > 0 },
            { key: 'ok', label: `후보 ${okList.length}` },
            { key: 'removed', label: `삭제 ${removedList.length}` },
          ].map((t) => (
            <button
              key={t.key} type="button" onClick={() => setTab(t.key)}
              className={
                'flex-1 rounded-xl py-2 text-xs font-bold transition ' +
                (tab === t.key
                  ? 'bg-gray-800 text-white'
                  : t.warn
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-50 text-gray-500')
              }
            >
              {t.warn && '⚠ '}{t.label}
            </button>
          ))}
        </div>

        {subsError ? (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-xs leading-relaxed text-red-600">
            ⚠ {subsError}
          </p>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">
            {tab === 'pending' ? '확인할 이름이 없습니다 👍' : '없습니다'}
          </p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {GROUPS.map((g) => {
              const items = shown.filter((s) => s.group_key === g.key)
              if (items.length === 0) return null
              return (
                <div key={g.key}>
                  <p className="mb-1.5 border-b border-gray-100 pb-1 text-[11px] font-bold text-gray-500">
                    {g.title} <span className="font-medium text-gray-400">({items.length}개)</span>
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <span className="flex-1 truncate">
                    <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                  </span>
                  {s.status !== 'ok' && (
                    <button
                      type="button" disabled={!!busy}
                      onClick={() => act(() => setSubmissionStatus(s.id, 'ok'), s.id)}
                      className="rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      공개
                    </button>
                  )}
                  {s.status !== 'removed' && (
                    <button
                      type="button" disabled={!!busy}
                      onClick={() => {
                        if (needsConfirm('down:' + s.id)) return
                        act(() => setSubmissionStatus(s.id, 'removed'), s.id)
                      }}
                      className={
                        'rounded-lg px-2.5 py-1 text-[11px] font-bold ' +
                        (armed === 'down:' + s.id
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 text-gray-600')
                      }
                    >
                      {armed === 'down:' + s.id ? '한 번 더' : '내리기'}
                    </button>
                  )}
                </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 그룹별 안내문 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-1 text-xs font-bold text-gray-500">그룹별 안내문</p>
        <p className="mb-3 text-[10px] leading-relaxed text-gray-400">
          공모 화면에 💡로 표시됩니다. 비워두면 기본 문구가 나옵니다.
        </p>
        {GROUPS.map((g) => (
          <label key={g.key} className="mb-2 block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">{g.title}</span>
            <textarea
              rows={2} value={notes[g.themeField] ?? ''}
              onChange={(e) => {
                notesDirtyRef.current = true
                setNotesSaved(false)
                setNotes((p) => ({ ...p, [g.themeField]: e.target.value }))
              }}
              placeholder={g.defaultNote}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        ))}
        <button
          type="button" disabled={busy === 'notes'}
          onClick={() =>
            act(async () => {
              await updateNotes(notes)
              notesDirtyRef.current = false
              setNotesSaved(true)
            }, 'notes')
          }
          className={
            'w-full rounded-xl py-2.5 text-xs font-bold text-white disabled:bg-gray-300 ' +
            (notesSaved ? 'bg-green-600' : 'bg-gray-800')
          }
        >
          {busy === 'notes' ? '저장 중...' : notesSaved ? '저장됐습니다 ✓' : '안내문 저장'}
        </button>
      </section>

      {/* 방 배정 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-1 text-xs font-bold text-gray-500">방 배정</p>
        <p className="mb-3 text-[10px] leading-relaxed text-gray-400">
          결과 공개 단계에서만 동작합니다. 뽑힌 이름을 같은 층 안에서 무작위로 배정합니다.
        </p>
        <button
          type="button"
          disabled={settings.phase !== 'result' || busy === 'assign'}
          onClick={() => {
            if (needsConfirm('assign')) return
            act(assignRoomsRandomly, 'assign')
          }}
          className={
            'w-full rounded-xl py-2.5 text-xs font-bold text-white disabled:bg-gray-300 ' +
            (armed === 'assign' ? 'bg-amber-500' : 'bg-gray-800')
          }
        >
          {busy === 'assign'
            ? '배정 중...'
            : armed === 'assign'
              ? '한 번 더 누르면 배정 (기존 배정은 덮어씁니다)'
              : '무작위로 방 배정하기'}
        </button>
        {rooms.some((r) => r.assigned_name) && (
          <ul className="mt-3 space-y-0.5 text-[11px] text-gray-500">
            {rooms.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span className="text-gray-400">{r.room_label}</span>
                <span className="font-semibold text-gray-700">{r.assigned_name ?? '-'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 참여자 명단 */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">참여자 명단</p>
          <button
            type="button"
            onClick={() => act(async () => setPeople(await fetchParticipants('submission')), 'people')}
            className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600"
          >
            공모 참여자 보기
          </button>
        </div>
        <p className="mb-2 text-[10px] leading-relaxed text-gray-400">
          누가 <b>어떤 이름</b>을 냈는지는 보안을 위해 앱에서 볼 수 없습니다.
          Supabase 대시보드 &gt; Table Editor &gt; submission_authors 에서 확인하세요.
        </p>
        {people.length > 0 && (
          <ul className="max-h-48 space-y-0.5 overflow-y-auto text-[11px] text-gray-600">
            {people.map((p, i) => (
              <li key={i} className="flex justify-between border-t border-gray-100 py-1">
                <span className="font-semibold">{p.person_name}</span>
                <span className="text-gray-400">{p.department}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-4 text-center text-[10px] text-gray-300">10초마다 자동으로 새로 읽습니다</p>
    </div>
  )
}
