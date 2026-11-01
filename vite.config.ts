import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  // Rutas relativas: la misma build funciona en la project page de GitHub Pages
  // (/Simulador-Particionado-y-Sistemas-de-Archivos/) y en cualquier subcarpeta o servidor local.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
