import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkWorkflow } from './check-workflows.mjs';

const sha = '0123456789abcdef0123456789abcdef01234567';

await test('accepts immutable actions, action subpaths, reusable workflows, and local references', () => {
    assert.deepEqual(
        checkWorkflow(`
jobs:
  build:
    steps:
      - uses: actions/checkout@${sha} # v7
      - uses: owner/repo/subpath@${sha}
      - uses: ./local/action
      - run: |
          echo 'uses: owner/action@main'
  verify:
    uses: owner/repo/.github/workflows/ci.yml@${sha}
  local:
    uses: ./.github/workflows/ci.yml
`),
        [],
    );
});

await test('rejects mutable tags, branches, short SHAs, expressions, and missing references', () => {
    for (const reference of [
        'owner/action@v7',
        'owner/action@main',
        'owner/action@0123456',
        '${{ inputs.action }}',
        '',
    ]) {
        const errors = checkWorkflow(`jobs: { build: { steps: [{ uses: '${reference}' }] } }`);
        assert.equal(errors.length, 1, reference);
        assert.match(errors[0], /jobs\.build\.steps\[0\]\.uses/u);
    }
});

await test('rejects mutable reusable workflows', () => {
    const errors = checkWorkflow('jobs: { verify: { uses: owner/repo/.github/workflows/ci.yml@main } }');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /jobs\.verify\.uses/u);
});

await test('checks YAML aliases and quoted or folded uses values', () => {
    const errors = checkWorkflow(`
jobs:
  build:
    steps:
      - &action { 'uses': 'owner/action@v7' }
      - *action
      - uses: >-
          owner/action@main
`);
    assert.equal(errors.length, 3);
});

await test('fails closed on invalid YAML and duplicate keys', () => {
    assert.throws(() => checkWorkflow('jobs: ['));
    assert.throws(() => checkWorkflow('jobs: { build: { uses: ./local, uses: owner/action@v7 } }'));
});
