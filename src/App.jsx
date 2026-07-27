// 앱의 중심 파일.
// 데이터 창고에서 "지금 어느 단계인지(phase)"를 읽어와, 그에 맞는 화면을 보여줍니다.
//   submission → 공모 화면
//   review     → 마감 안내 화면
//   voting     → 투표 화면 (5단계에서 만들 예정)
//   result     → 결과 화면 (6단계에서 만들 예정)
import { useEffect, useState } from 'react'
import { stepKeyForPhase } from './lib/config'
import { fetchSettings } from './lib/db'
import PhaseStepper from './components/PhaseStepper'
import SubmissionPage from './pages/SubmissionPage'

export default function App() {
  const [settings, setSettings] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    fetchSettings()
      .then((data) => {
        if (alive) setSettings(data)
      })
      .catch((error) => {
        console.error('설정 읽기 실패:', error)
        if (alive) setLoadError('서버에 연결하지 못했습니다.')
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="mb-8">
        <PhaseStepper current={stepKeyForPhase(settings?.phase)} />
      </header>

      {/* 아직 불러오는 중 */}
      {!settings && !loadError && (
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </main>
      )}

      {/* 연결 실패 */}
      {loadError && (
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-3 text-4xl">😵</div>
          <p className="mb-1 text-sm font-semibold text-gray-700">{loadError}</p>
          <p className="text-xs text-gray-400">
            잠시 후 새로고침해 주세요. 계속되면 담당자에게 알려주세요.
          </p>
        </main>
      )}

      {/* 단계별 화면 */}
      {settings && (
        <main className="flex flex-1 flex-col">
          {settings.phase === 'submission' && <SubmissionPage settings={settings} />}
          {settings.phase === 'review' && (
            <Notice
              emoji="🔒"
              title="공모가 마감되었습니다"
              body={'제출된 이름들을 정리하고 있어요.\n곧 투표가 열립니다.'}
            />
          )}
          {settings.phase === 'voting' && (
            <Notice
              emoji="🗳️"
              title="투표 화면 준비 중"
              body={'투표 화면은 다음 단계에서 만듭니다.\n(5단계)'}
            />
          )}
          {settings.phase === 'result' && (
            <Notice
              emoji="🏆"
              title="결과 화면 준비 중"
              body={'결과 화면은 다음 단계에서 만듭니다.\n(6단계)'}
            />
          )}
        </main>
      )}
    </div>
  )
}

// 간단한 안내 화면 (아직 화면이 없는 단계에서 사용)
function Notice({ emoji, title, body }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <h1 className="mb-2 text-2xl font-bold text-gray-800">{title}</h1>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">{body}</p>
    </div>
  )
}
