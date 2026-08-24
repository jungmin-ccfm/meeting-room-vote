// 부서(팀) 선택 드롭다운
// 공모·투표 화면에서 함께 씁니다. 조직도 기준 목록(config.js의 DEPARTMENTS)에서
// 고르게 해 표기를 통일합니다 — 같은 팀을 다르게 적어 중복 확인이 어긋나는 걸 막습니다.
// 목록에 없는 소속은 "기타 (직접 입력)"을 고르면 입력칸이 열립니다.
import { useState } from 'react'
import { DEPARTMENTS } from '../lib/config'

const ETC = '__etc__'

export default function DepartmentSelect({ value, onChange, highlight = false, compact = false }) {
  const [etcMode, setEtcMode] = useState(false)

  const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3'
  const tone = highlight ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
  const base = `w-full rounded-xl border text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${pad} ${tone}`

  function handleSelect(e) {
    const v = e.target.value
    if (v === ETC) {
      setEtcMode(true)
      onChange('')
    } else {
      setEtcMode(false)
      onChange(v)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <select
        value={etcMode ? ETC : value}
        onChange={handleSelect}
        className={`${base} ${!etcMode && !value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <option value="" disabled>
          부서(팀) 선택
        </option>
        {DEPARTMENTS.map((group) =>
          group.teams ? (
            <optgroup key={group.label} label={group.label}>
              {group.teams.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.short}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={group.value} value={group.value}>
              {group.value}
            </option>
          ),
        )}
        <option value={ETC}>기타 (직접 입력)</option>
      </select>

      {etcMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={30}
          placeholder="소속을 직접 입력해 주세요"
          autoFocus
          className={base}
        />
      )}
    </div>
  )
}
