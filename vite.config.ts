import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',            // <-- ensures Vite uses index.html at project root
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
