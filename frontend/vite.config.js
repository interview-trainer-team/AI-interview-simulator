import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1", // один адрес для разработки: http://127.0.0.1:5173
    port: 5173,
    proxy: {
      // Запросы /api уходят на backend: браузеру не нужны ни localhost:8000, ни CORS
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // <-- Указываем, что @ это папка src
    },
  },
})
