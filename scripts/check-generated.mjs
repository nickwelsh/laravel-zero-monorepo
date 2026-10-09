import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const expected = execFileSync('php', ['tests/interop/export.php', 'generate'], {
    encoding: 'utf8',
});
if (expected !== readFileSync('tests/interop/generated.ts', 'utf8')) {
    throw new Error(
        'Generated contracts are stale. Run php tests/interop/export.php generate > tests/interop/generated.ts.',
    );
}
console.log('Generated contracts match the PHP model definitions.');
