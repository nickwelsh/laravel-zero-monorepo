import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// Waku already rendered every route. Package its output as Workers Static Assets.
export default defineConfig({
    publicDir: 'dist/public',
    build: { outDir: '.cloudflare/build' },
    plugins: [cloudflare()],
});
