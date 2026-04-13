import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PointTaken/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        tracker: 'tracker.html',
      },
    },
  },
});
