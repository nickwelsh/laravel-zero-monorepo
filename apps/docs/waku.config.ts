import { defineConfig } from '@nickwelsh/docs-base';

export default defineConfig({
    name: 'Laravel Zero',
    origin: 'https://docs.nickwelsh.me',
    githubUrl: 'https://github.com/nickwelsh/laravel-zero',
    githubBranch: 'main',
    basePath: '/laravel-zero',
    content: './content/docs',
    refquill: [
        {
            input: './generated/api.json',
            baseUrl: '/docs/0.x/api',
            title: 'API reference',
        },
    ],
});
