import { describe, expect, it } from 'vite-plus/test';
import { execFileSync } from 'node:child_process';
import { createBuilder } from '@rocicorp/zero';
import { handleQueryRequest } from '@rocicorp/zero/server';
import { schema, queries } from './generated';
import type { QueryArgs } from '@laravel-zero/client';

describe('PHP / native Zero query equivalence', () => {
    for (const [name, args] of [
        ['Task.all', {}],
        [
            'Task.all',
            {
                filters: {
                    completed_after: 1700000000000,
                    title_operator: { operator: '!=', value: 'hidden' },
                    title_start: 'a%_',
                    search: 'title',
                    is_completed: true,
                    title_is: 'test',
                },
            },
        ],
        [
            'Task.all',
            {
                filters: { done: false, title: 'a%_\\b', completed_at: null },
                include: { list: {} },
            },
        ],
        ['Task.all', { filters: { list: 'list-a' }, order: [['title', 'asc']], limit: 23 }],
        ['Task.all', { filters: { trashed: 'only' } }],
        ['Task.all', { include: { tags: {}, comments: { limit: 5 } } }],
        ['Task.all', { include: { list: { include: { tasks: { limit: 2 } } } } }],
        ['Task.one', { id: 'a', include: { list: {} } }],
    ] as const) {
        it(`${name} ${JSON.stringify(args)}`, async () => {
            const body = ['transform', [{ id: 'q', name, args: [args] }]];
            const native = await handleQueryRequest({
                schema,
                body,
                query: {},
                userID: 'alice',
                handler: (queryName, queryArgs) => {
                    const operation = queryName.split('.')[1];
                    return queries.Task[operation as 'all' | 'one'].fn({
                        args: queryArgs as QueryArgs,
                        ctx: { user_id: 'alice' },
                    });
                },
            });
            const php = JSON.parse(
                execFileSync('php', ['tests/interop/export.php', name, JSON.stringify(args)], { encoding: 'utf8' }),
            );
            expect('kind' in native && native.kind).toBe('QueryResponse');
            if ('kind' in native && native.kind === 'QueryResponse')
                expect(native.queries[0]).toEqual({ id: 'q', name, ast: php });
        });
    }
});

it('compiles mandatory runtime scope boolean algebra to native ZQL', async () => {
    const native = await handleQueryRequest({
        schema,
        body: ['transform', [{ id: 'q', name: 'Task.all', args: [{}] }]],
        query: {},
        userID: 'alice',
        handler: () =>
            createBuilder(schema)
                .tasks.where('user_id', 'alice')
                .where((eb) => eb.or(eb.cmp('done', true), eb.cmp('title', 'shared')))
                .where('deleted_at', 'IS', null)
                .orderBy('created_at', 'desc')
                .orderBy('id', 'asc')
                .limit(50),
    });
    const php = JSON.parse(
        execFileSync('php', ['tests/interop/export.php', 'Task.all', '{}', 'scope'], { encoding: 'utf8' }),
    );
    if ('kind' in native && native.kind === 'QueryResponse')
        expect(native.queries[0]).toEqual({ id: 'q', name: 'Task.all', ast: php });
    else throw new Error('Expected a native query response.');
});
