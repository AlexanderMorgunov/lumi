import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  // Local previews and clean checkouts under artifacts are not app entries.
  optimizeDeps: { entries: ['index.html'] },
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    watch: {
      ignored: [
        '**/artifacts/**',
        '**/test-results/**',
        '**/playwright-report/**',
      ],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
        },
      },
    },
  },
});
