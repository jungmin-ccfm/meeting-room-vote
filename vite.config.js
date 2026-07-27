import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite 설정 파일: React와 Tailwind를 켜주는 역할
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // 모든 주소(IPv4 127.0.0.1 포함)에서 접속 허용 + 휴대폰 테스트 가능
    port: 5173,
  },
})
