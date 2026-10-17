import { defineConfig, triggers } from 'cf/config';

export default defineConfig({
    worker: {
        name: 'laravel-zero-docs',
        compatibilityDate: '2026-10-17',
        workersDev: false,
        previewUrls: false,
        assets: {
            basePath: '/laravel-zero',
            htmlHandling: 'auto-trailing-slash',
            notFoundHandling: '404-page',
        },
        triggers: [
            triggers.fetch({ pattern: 'docs.nickwelsh.me/laravel-zero', zone: 'nickwelsh.me' }),
            triggers.fetch({ pattern: 'docs.nickwelsh.me/laravel-zero/*', zone: 'nickwelsh.me' }),
        ],
        observability: {
            enabled: true,
            logs: { enabled: true },
            traces: { enabled: true, headSamplingRate: 0.01 },
        },
    },
});
