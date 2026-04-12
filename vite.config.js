import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // tracker: 'tracker.html', — add this in Task 6 when tracker.html is created
      },
    },
  },
});
