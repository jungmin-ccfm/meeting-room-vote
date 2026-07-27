// 앱의 첫 화면 (임시). 1단계에서는 "뼈대가 잘 뜨는지"만 확인합니다.
// 상단 진행 단계 표시와 디자인 톤을 미리 볼 수 있게 해뒀습니다.

const STEPS = [
  { key: 'submission', label: '공모' },
  { key: 'voting', label: '투표' },
  { key: 'result', label: '결과' },
]

function PhaseStepper({ current = 'submission' }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ' +
                  (active
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200'
                    : done
                      ? 'bg-indigo-100 text-indigo-500'
                      : 'bg-gray-100 text-gray-400')
                }
              >
                {i + 1}
              </div>
              <span
                className={
                  'text-xs font-semibold ' +
                  (active ? 'text-indigo-600' : 'text-gray-400')
                }
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mb-5 h-0.5 w-8 rounded bg-gray-200" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="mb-8">
        <PhaseStepper current="submission" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 text-5xl">🏷️</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-800">
          회의실 이름 짓기
        </h1>
        <p className="text-sm leading-relaxed text-gray-500">
          우리 회의실 이름을 다 함께 정해요.
          <br />
          공모 → 투표 → 결과 순서로 진행됩니다.
        </p>

        <div className="mt-8 rounded-2xl bg-white px-5 py-4 text-sm text-gray-400 shadow-sm">
          ✅ 앱 뼈대가 정상적으로 떴습니다. (1단계 완료)
        </div>
      </main>
    </div>
  )
}
