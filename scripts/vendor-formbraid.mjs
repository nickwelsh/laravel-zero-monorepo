// Formbraid has no usable published runtime yet. Pin and build its public contract
// for development; the client itself uses type-only imports from @formbraid/core.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const revision = '6dce7fcdf410394f73133f22850b9bf86c0462b0';
const root = fileURLToPath(new URL('../', import.meta.url));
const checkout = process.argv[2] ? resolve(process.argv[2]) : mkdtempSync(join(tmpdir(), 'zero-formbraid-'));
const run = (command, args, cwd = checkout) => execFileSync(command, args, { cwd, stdio: 'inherit' });
if (!process.argv[2]) {
    run('git', ['clone', 'https://github.com/nickwelsh/formbraid.git', '.']);
    run('git', ['checkout', '--detach', revision]);
}
const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
if (actual !== revision) throw new Error(`Expected Formbraid ${revision}, received ${actual}.`);
try {
    symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
} catch (error) {
    if (error.code !== 'EEXIST') throw error;
}
writeFileSync(
    join(checkout, 'tsconfig.vendor.json'),
    JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            strict: true,
            exactOptionalPropertyTypes: true,
            noUncheckedIndexedAccess: true,
            skipLibCheck: true,
            declaration: true,
            outDir: './vendor-build',
            rootDir: './packages',
            paths: { '@formbraid/core': ['./packages/core/src/index.ts'] },
        },
        files: ['./packages/core/src/index.ts', './packages/react/src/index.ts'],
    }),
);
run(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.vendor.json']);
mkdirSync(join(root, 'tests/fixtures/formbraid'), { recursive: true });
for (const name of ['core', 'react']) {
    const output = join(checkout, 'vendor-build', name);
    const manifest = JSON.parse(readFileSync(join(checkout, 'packages', name, 'package.json'), 'utf8'));
    manifest.version = '0.1.0';
    manifest.files = ['src', 'LICENSE'];
    manifest.exports = { '.': { types: './src/index.d.ts', import: './src/index.js' } };
    delete manifest.scripts;
    delete manifest.devDependencies;
    delete manifest.peerDependenciesMeta;
    if (name === 'react') {
        manifest.dependencies['@formbraid/core'] = '0.1.0';
        delete manifest.peerDependencies['@formbraid/generator'];
    }
    writeFileSync(join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    writeFileSync(join(output, 'LICENSE'), readFileSync(join(checkout, 'LICENSE')));
    run(
        'npm',
        [
            'pack',
            '--ignore-scripts',
            '--cache',
            join(checkout, 'npm-cache'),
            '--pack-destination',
            join(root, 'tests/fixtures/formbraid'),
        ],
        output,
    );
}
