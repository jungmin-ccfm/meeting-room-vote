// 결과 화면
//
// 설계 메모
//  - 선정된 이름은 순위와 득표수를 공개합니다. (왜 1등인지 근거가 있어야 하니까)
//  - 선정되지 않은 후보의 득표수는 공개하지 않습니다.
//    후보 중 17~21%가 0표를 받습니다. 그걸 다 공개하면 낸 사람이 상합니다.
//    그리고 6등·7등이 1표 차이인 경우가 많아 불필요한 시비가 생깁니다.
//  - 동표는 "먼저 제출된 이름" 우선. 이 규칙은 공모 시작 전에 공지합니다.
import { useEffect, useState } from 'react'
import { GROUPS } from '../lib/config'
import { fetchResults, fetchRooms, countParticipants } from '../lib/db'

const MEDALS = ['🥇', '🥈', '🥉']

export default function ResultPage() {
  const [results, setResults] = useState(null)
  const [rooms, setRooms] = useState([])
  const [voterCount, setVoterCount] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([fetchResults(), fetchRooms(), countParticipants('voting')])
      .then(([r, rm, vc]) => {
        if (!alive) return
        setResults(r); setRooms(rm); setVoterCount(vc)
      })
      .catch((e) => {
        console.error('결과 조회 실패:', e)
        if (alive) setError('결과를 불러오지 못했습니다.')
      })
    return () => { alive = false }
  }, [])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-3 text-4xl">😵</div>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">결과를 불러오는 중...</p>
      </div>
    )
  }

  const assigned = rooms.some((r) => r.assigned_name)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="text-center">
        <div className="mb-3 text-5xl">🏆</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">회의실 이름이 정해졌습니다</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          함께 정해주셔서 감사합니다.
          {voterCount !== null && (
            <>
              <br />
              총 <b className="text-gray-700">{voterCount}명</b>이 투표에 참여했습니다.
            </>
          )}
        </p>
      </div>

      {GROUPS.map((g) => {
        const { winners, totalCandidates } = results[g.key]
        const groupRooms = rooms.filter((r) => r.group_key === g.key)
        return (
          <section key={g.key} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-800">{g.title}</h2>
              <span className="text-xs text-gray-400">후보 {totalCandidates}개 중 {g.pick}개</span>
            </div>

            <ol className="space-y-2">
              {winners.map((w, i) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center text-sm">
                      {MEDALS[i] ?? <span className="text-xs text-gray-400">{i + 1}위</span>}
                    </span>
                    <span className="font-bold text-gray-800">{w.name}</span>
                  </span>
                  <span className="text-sm font-semibold text-indigo-600">{w.votes}표</span>
                </li>
              ))}
            </ol>

            {/* 방 배정 결과 */}
            {assigned && groupRooms.some((r) => r.assigned_name) && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-bold text-gray-500">방 배정</p>
                <ul className="space-y-1 text-sm">
                  {groupRooms.map((r) => (
                    <li key={r.id} className="flex justify-between text-gray-600">
                      <span className="text-gray-400">{r.room_label}</span>
                      <span className="font-semibold text-gray-800">{r.assigned_name ?? '-'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )
      })}

      <div className="rounded-2xl bg-white p-5 text-xs leading-relaxed text-gray-400 shadow-sm">
        <p>· 선정되지 않은 이름의 득표수는 제출자 보호를 위해 공개하지 않습니다.</p>
        <p>· 동표인 경우 먼저 제출된 이름을 선정했습니다.</p>
        <p>· 방 배정은 같은 층 안에서 무작위로 진행했습니다.</p>
      </div>
    </div>
  )
}
