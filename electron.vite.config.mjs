import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  main: {
    // 把 dependencies(含原生模組 uiohook-napi)排除在 bundle 外
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        // 各畫面各自一個 HTML 進入點
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          control: resolve(__dirname, 'src/renderer/control.html'),
          toast: resolve(__dirname, 'src/renderer/toast.html')
        }
      }
    },
    plugins: [vue()]
  }
});
