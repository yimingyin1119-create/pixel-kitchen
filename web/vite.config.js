import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/pixel-kitchen/',
  plugins: [preact()],
  build: { target: ['es2019', 'safari13'] }, // WeChat's in-app browser
  server: { fs: { allow: ['..'] } }, // shares ../core (units, time) with the backend
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.js'] },
});
