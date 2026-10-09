import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    fmt: {
        semi: true,
        singleQuote: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        printWidth: 120,
        tabWidth: 4,
        sortPackageJson: true,
        ignorePatterns: ['**/vendor/**', '**/dist/**', 'tests/interop/generated.ts', 'pnpm-lock.yaml'],
        overrides: [{ files: ['*.yaml', '*.yml'], options: { tabWidth: 2 } }],
    },
    lint: {
        categories: { correctness: 'error', suspicious: 'error', perf: 'off' },
        plugins: ['typescript', 'unicorn', 'oxc', 'react', 'react-perf', 'jsx-a11y', 'eslint', 'import', 'promise'],
        jsPlugins: [
            'eslint-plugin-no-only-tests',
            'eslint-plugin-no-use-extend-native',
            'eslint-plugin-regexp',
            { name: 'react-hooks-plugin', specifier: 'eslint-plugin-react-hooks' },
        ],
        overrides: [
            { files: ['**/*.test.{ts,tsx}'], rules: { 'unicorn/consistent-function-scoping': 'off' } },
            {
                files: ['tests/interop/types.ts'],
                rules: {
                    'eslint/no-unused-vars': 'off',
                    'eslint/no-unused-expressions': 'off',
                    'unicorn/consistent-function-scoping': 'off',
                },
            },
        ],
        options: { typeAware: true, typeCheck: true },
        ignorePatterns: ['**/vendor/**', '**/dist/**', 'tests/interop/generated.ts'],
        rules: {
            'no-only-tests/no-only-tests': 'error',
            'no-use-extend-native/no-use-extend-native': 'error',
            'react-hooks-plugin/rules-of-hooks': 'error',
            'react-hooks-plugin/exhaustive-deps': 'error',
            'typescript/consistent-type-imports': 'error',
            // React's automatic JSX runtime needs no React import.
            'react/react-in-jsx-scope': 'off',
            // Use the official plugin for hook dependency diagnostics.
            'react/exhaustive-deps': 'off',
            'react/memo-dependencies': 'off',
            // Compiler-only restrictions don't model our external store factories.
            'react/refs': 'off',
            'react/immutability': 'off',
            'react/globals': 'off',
            // Dynamic generated registries bridge mapped types at a validated boundary.
            'typescript/no-unsafe-type-assertion': 'off',
            'typescript/no-unnecessary-type-arguments': 'off',
        },
    },
    resolve: {
        alias: {
            '@laravel-zero/client/react': fileURLToPath(
                new URL('./packages/client/src/react/index.ts', import.meta.url),
            ),
            '@laravel-zero/client': fileURLToPath(new URL('./packages/client/src/index.ts', import.meta.url)),
        },
    },
    test: {
        include: ['packages/**/*.test.{ts,tsx}', 'tests/interop/**/*.test.ts'],
    },
});
