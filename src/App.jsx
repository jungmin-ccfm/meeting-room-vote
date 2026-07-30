// 앱의 중심 파일.
// 주소가 /admin 이면 관리자 화면, 그 외에는 DB의 phase 에 맞는 화면을 보여줍니다.
//   submission → 공모 화면
//   review     → 마감 안내
//   voting     → 투표 화면
//   result     → 결과 화면
import { useEffect, useState } from 'react'
import { stepKeyForPhase } from './lib/config'
import { fetchSettings } from './lib/db'
import PhaseStepper from './components/PhaseStepper'
import SubmissionPage from './pages/SubmissionPage'
import VotingPage from './pages/VotingPage'
import ResultPage from './pages/ResultPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

  const [settings, setSettings] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (isAdmin) return
    let alive = true
    fetchSettings()
      .then((data) => { if (alive) setSettings(data) })
      .catch((error) => {
        console.error('설정 읽기 실패:', error)
        if (alive) setLoadError('서버에 연결하지 못했습니다.')
      })
    return () => { alive = false }
  }, [isAdmin])

  if (isAdmin) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <AdminPage />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="mb-6">
        <PhaseStepper current={stepKeyForPhase(settings?.phase)} />
      </header>

      {!settings && !loadError && (
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </main>
      )}

      {loadError && (
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-3 text-4xl">😵</div>
          <p className="mb-1 text-sm font-semibold text-gray-700">{loadError}</p>
          <p className="text-xs text-gray-400">
            잠시 후 새로고침해 주세요. 계속되면 담당자에게 알려주세요.
          </p>
        </main>
      )}

      {settings && (
        <main className="flex flex-1 flex-col">
          {settings.phase === 'submission' && <SubmissionPage settings={settings} />}
          {settings.phase === 'review' && (
            <Notice
              emoji="🔒"
              title="공모가 마감되었습니다"
              body={'제출된 이름을 확인하고 있어요.\n곧 투표가 열립니다.'}
            />
          )}
          {settings.phase === 'voting' && <VotingPage />}
          {settings.phase === 'result' && <ResultPage />}
        </main>
      )}
    </div>
  )
}

// 간단한 안내 화면
function Notice({ emoji, title, body }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 text-5xl">{emoji}</div>
      <h1 className="mb-2 text-2xl font-bold text-gray-800">{title}</h1>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500">{body}</p>
    </div>
  )
}
