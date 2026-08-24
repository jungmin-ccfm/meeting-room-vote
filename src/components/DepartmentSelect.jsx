// 부서(팀) 선택 드롭다운
// 공모·투표 화면에서 함께 씁니다. 조직도 기준 목록(config.js의 DEPARTMENTS)에서
// 고르게 해 표기를 통일합니다 — 같은 팀을 다르게 적어 중복 확인이 어긋나는 걸 막습니다.
//
// 네이티브 <select>는 옵션 스타일(볼드·들여쓰기)이 안 먹고 휴대폰에서는 OS 기본
// 피커가 떠버려서, 직접 그리는 커스텀 드롭다운으로 만들었습니다.
// 목록에 없는 소속은 "기타 (직접 입력)"을 고르면 입력칸이 열립니다.
import { useState } from 'react'
import { DEPARTMENTS } from '../lib/config'

export default function DepartmentSelect({ value, onChange, highlight = false, compact = false }) {
  const [open, setOpen] = useState(false)
  const [etcMode, setEtcMode] = useState(false)

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const tone = highlight ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
  const base = `w-full rounded-xl border text-sm outline-none ${pad} ${tone}`

  function pick(v) {
    setEtcMode(false)
    onChange(v)
    setOpen(false)
  }
  function pickEtc() {
    setEtcMode(true)
    onChange('')
    setOpen(false)
  }

  const label = etcMode ? '기타 (직접 입력)' : value

  return (
    <div className="relative flex min-w-0 flex-1 flex-col gap-2">
      {/* 현재 선택값을 보여주는 버튼 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${base} flex items-center justify-between text-left focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
          label ? 'text-gray-800' : 'text-gray-400'
        }`}
      >
        <span className="truncate">{label || '부서(팀) 선택'}</span>
        <span className={`ml-2 shrink-0 text-[10px] text-gray-400 transition ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫히도록 하는 투명 배경.
              preventDefault: label 등으로 감싸였을 때 클릭이 여닫이 버튼으로
              한 번 더 전달되어 닫히자마자 다시 열리는 것을 막습니다. */}
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => { e.preventDefault(); setOpen(false) }}
          />

          <div
            className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl shadow-gray-200/60"
            onClick={(e) => e.preventDefault()}
          >
            {DEPARTMENTS.map((entry) =>
              entry.teams ? (
                // 본부 그룹: 볼드 제목 + 들여쓴 팀 목록
                <div key={entry.label}>
                  <p className="px-4 pb-1 pt-2.5 text-xs font-bold text-gray-800">{entry.label}</p>
                  {entry.teams.map((t) => {
                    const on = !etcMode && value === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => pick(t.value)}
                        className={`flex w-full items-center py-2 pl-8 pr-4 text-left text-sm transition ${
                          on ? 'bg-indigo-50 font-bold text-indigo-600' : 'text-gray-600 active:bg-gray-50'
                        }`}
                      >
                        {on && <span className="mr-1.5">✓</span>}
                        {t.short}
                      </button>
                    )
                  })}
                </div>
              ) : (
                // 세부 팀이 없는 조직: 그 자체가 선택지 (본부 제목과 같은 볼드)
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => pick(entry.value)}
                  className={`flex w-full items-center px-4 py-2.5 text-left text-sm font-bold transition ${
                    !etcMode && value === entry.value
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-800 active:bg-gray-50'
                  }`}
                >
                  {!etcMode && value === entry.value && <span className="mr-1.5">✓</span>}
                  {entry.value}
                </button>
              ),
            )}

            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={pickEtc}
              className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition ${
                etcMode ? 'bg-indigo-50 font-bold text-indigo-600' : 'text-gray-500 active:bg-gray-50'
              }`}
            >
              {etcMode && <span className="mr-1.5">✓</span>}
              기타 (직접 입력)
            </button>
          </div>
        </>
      )}

      {etcMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={30}
          placeholder="소속을 직접 입력해 주세요"
          autoFocus
          className={`${base} focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
        />
      )}
    </div>
  )
}
