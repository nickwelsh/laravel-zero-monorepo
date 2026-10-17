import { defineConfig } from '@nickwelsh/docs-base';

export default defineConfig({
    name: 'Zero for Laravel',
    origin: 'https://docs.nickwelsh.me',
    githubUrl: 'https://github.com/nickwelsh/zero-for-laravel-monorepo',
    githubBranch: 'main',
    basePath: '/zero-for-laravel',
    content: './content/docs',
    refquill: [
        {
            input: './generated/api.json',
            baseUrl: '/docs/0.x/api',
            title: 'API reference',
        },
    ],
});
