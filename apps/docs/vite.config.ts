import { cloudflare } from '@cloudflare/vite-plugin';
import { cp, rm } from 'node:fs/promises';
import { defineConfig } from 'vite';

// Waku already rendered every route. Package its output as Workers Static Assets.
export default defineConfig(async () => {
    // Prefix the asset paths directly; assets.basePath is account-gated.
    const publicDir = '.cloudflare/public';
    await rm(publicDir, { recursive: true, force: true });
    await cp('dist/public', `${publicDir}/laravel-zero`, { recursive: true });
    return {
        publicDir,
        build: { outDir: '.cloudflare/build' },
        plugins: [cloudflare()],
    };
});
