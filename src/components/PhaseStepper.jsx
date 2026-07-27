// 화면 맨 위에 있는 진행 단계 표시(공모 → 투표 → 결과).
// 지금이 어느 단계인지 동그라미 색으로 알려줍니다.
import { STEPS } from '../lib/config'

export default function PhaseStepper({ current = 'submission' }) {
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
