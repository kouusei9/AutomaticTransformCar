import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // 监听所有网络接口，允许外部访问
    port: 5173,      // 开发服务器端口
    strictPort: false, // 端口被占用时自动尝试下一个可用端口
  },
})
