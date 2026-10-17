import { defineConfig, triggers } from 'cf/config';

export default defineConfig({
    worker: {
        name: 'zero-for-laravel-docs',
        compatibilityDate: '2026-10-17',
        workersDev: false,
        previewUrls: false,
        assets: {
            htmlHandling: 'auto-trailing-slash',
            notFoundHandling: '404-page',
        },
        triggers: [
            triggers.fetch({ pattern: 'docs.nickwelsh.me/zero-for-laravel', zone: 'nickwelsh.me' }),
            triggers.fetch({ pattern: 'docs.nickwelsh.me/zero-for-laravel/*', zone: 'nickwelsh.me' }),
        ],
        observability: {
            enabled: true,
            logs: { enabled: true },
            traces: { enabled: true, headSamplingRate: 0.01 },
        },
    },
});
