import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Kopiera .well-known (Vite ignorerar dot-mappar annars)
    viteStaticCopy({
      targets: [
        { src: 'public/.well-known', dest: '.' },
      ],
    }),
  ],
})
