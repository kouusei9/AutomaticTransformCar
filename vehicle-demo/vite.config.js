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
  
  // 生产构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    
    // 优化配置
    rollupOptions: {
      output: {
        // 代码分割优化
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    
    // 大文件警告阈值（500KB）
    chunkSizeWarningLimit: 500,
  },
  
  // 预览服务器配置（用于测试生产构建）
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
