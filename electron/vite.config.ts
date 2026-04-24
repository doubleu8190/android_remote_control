import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    // 移除HTML中的crossorigin属性，修复Electron file://协议下模块脚本加载失败的问题
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\s*crossorigin(=["'][^"']*["'])?/g, '');
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});