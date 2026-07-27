// Supabase(데이터 창고)에 접속하는 통로.
// 접속 정보는 .env.local 파일에서 읽어옵니다.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // 접속 정보가 없으면 화면 대신 콘솔에 알려줍니다.
  console.error('Supabase 접속 정보(.env.local)가 없습니다.')
}

export const supabase = createClient(url, anonKey)
