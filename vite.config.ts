import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/map4child/',
  build: { assetsInlineLimit: 0, sourcemap: false },
});
