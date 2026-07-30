// 이름 문자열을 다루는 도구들
// - 정리(공백 처리)
// - 비슷한 이름 찾기 (제출자에게 알려주기 위한 용도. 자동으로 합치지는 않음)
// - 자동 보류 대상 판별 (금칙어·직급 단어 등)

// 앞뒤 공백 제거 + 중간 공백을 한 칸으로
export function tidy(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ')
}

// 비교용 형태: 공백 전부 제거 + 소문자
// "곰 돌이" 와 "곰돌이" 를 같은 이름으로 보기 위한 것
export function normalize(text) {
  return tidy(text).replace(/\s/g, '').toLowerCase()
}

// 편집 거리 (한 글자 고치면 같아지는지 판단용)
function editDistance(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 9
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev.length = 0
    prev.push(...cur)
  }
  return prev[b.length]
}

// 입력한 이름과 "비슷한" 기존 이름들을 찾아준다.
// 반환: { exact: '곰' | null, similar: ['곰돌이', '큰곰'] }
//
// 완전히 같은 이름(exact)은 시스템이 자동으로 막는다.
// 비슷한 이름(similar)은 알려만 주고, 그대로 낼지는 본인이 정한다.
export function findLookalikes(input, existingNames) {
  const key = normalize(input)
  if (!key) return { exact: null, similar: [] }

  let exact = null
  const similar = []

  for (const name of existingNames) {
    const other = normalize(name)
    if (!other) continue
    if (other === key) { exact = name; continue }

    const shorter = key.length <= other.length ? key : other
    const contains = shorter.length >= 2 && (other.includes(key) || key.includes(other))
    const close = editDistance(key, other) <= 1 && key.length >= 2

    if (contains || close) similar.push(name)
  }

  return { exact, similar: similar.slice(0, 5) }
}

// ------------------------------------------------------------
// 자동 보류 대상 판별
// 걸리면 목록에 바로 뜨지 않고 담당자 확인을 기다린다(status='pending').
// 기계가 걸러낸 것만 사람이 확인하므로 "취향으로 뺐다"는 말이 안 나온다.
// ------------------------------------------------------------

// 직급·호칭 단어 — "김부장독방" 같은 특정인 조롱을 막기 위함
const TITLES = [
  '사장', '부사장', '회장', '대표', '상무', '전무', '이사', '실장',
  '부장', '차장', '과장', '팀장', '대리', '주임', '사원', '인턴',
]

// 노골적인 비속어 (기본 목록. 운영하면서 추가하면 됨)
const BADWORDS = [
  '씨발', '시발', '씨빨', '개새', '새끼', '병신', '지랄', '좆', '엿같',
  '미친', '닥쳐', '꺼져', '멍청', '바보', '등신', '한심',
  'fuck', 'shit', 'bitch', 'damn',
]

// 부적절한 소재
const SENSITIVE = ['감옥', '무덤', '지옥', '노예', '고문', '독방', '창고방']

export function screenName(rawName) {
  const name = tidy(rawName)
  const flat = normalize(name)

  if (!name) return { ok: false, status: 'reject', reason: '이름을 입력해 주세요.' }

  if (name.length > 12)
    return { ok: false, status: 'reject', reason: '이름은 12자까지 가능합니다.' }

  // 비속어는 아예 등록을 막는다
  for (const w of BADWORDS) {
    if (flat.includes(w)) {
      return { ok: false, status: 'reject', reason: '사용할 수 없는 표현이 포함되어 있습니다.' }
    }
  }

  // 아래 항목들은 등록은 되지만 담당자 확인 후 공개된다
  const flags = []
  for (const t of TITLES) if (flat.includes(t)) flags.push('직급·호칭')
  for (const s of SENSITIVE) if (flat.includes(s)) flags.push('부적절 소재')
  if (/[0-9]/.test(flat)) flags.push('숫자 포함')
  if (/[!@#$%^&*()_+=\[\]{};:'"\\|<>/?~`]/.test(name)) flags.push('특수문자')

  if (flags.length) {
    return {
      ok: true,
      status: 'pending',
      reason: `${[...new Set(flags)].join(', ')}가 포함되어 담당자 확인 후 후보에 올라갑니다.`,
    }
  }

  return { ok: true, status: 'ok', reason: '' }
}

// ------------------------------------------------------------
// 사람마다 다른 순서로 후보를 보여주기 위한 섞기
// 같은 seed 를 주면 항상 같은 순서가 나온다
// (새로고침해도 순서가 안 바뀌게 하려고 seed 를 쓴다)
// ------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWithSeed(list, seed) {
  const rand = mulberry32(seed)
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
