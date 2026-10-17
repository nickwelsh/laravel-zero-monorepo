// @vitest-environment jsdom
import { nestedRuntime } from '../../../tests/interop/nested';
import { Zero } from '@rocicorp/zero';
import type { ClientContext } from './index';
import { describe, expect, it } from 'vite-plus/test';
import { createLaravelZero } from './runtime';
import { Task, schema, mutators, definitions } from '../../../tests/interop/generated';

describe('native Zero optimistic CRUD', () => {
    it('creates, patches, soft deletes, restores, and force deletes in the actual local store', async () => {
        const zero = new Zero<typeof schema, undefined, ClientContext>({
            schema,
            mutators,
            context: { user_id: 'alice' },
            userID: 'alice',
            cacheURL: null,
            kvStore: 'mem',
            logLevel: 'error',
        });
        try {
            const create = Task.create().prepare({ title: 'Local task' });
            expect(await zero.mutate(create).client).toEqual({ type: 'success' });
            let rows = await zero.run(Task.query().all().request());
            expect(rows).toHaveLength(1);
            expect(rows?.[0]).toMatchObject({
                id: create.args.id,
                user_id: 'alice',
                done: false,
                completed_at: null,
                title: 'Local task',
            });
            expect(rows?.[0]?.created_at).toBe(create.args.now);
            const record = Task.query().all().with('comments').decode(rows)[0]!;
            await zero.mutate(
                record.update().prepare({
                    done: true,
                    completed_at: new Date(1700000000123),
                }),
            ).client;
            rows = await zero.run(Task.query().all().request());
            expect(rows?.[0]).toMatchObject({
                done: true,
                completed_at: 1700000000123,
                title: 'Local task',
            });
            await zero.mutate(record.destroy().prepare({})).client;
            expect(await zero.run(Task.query().all().request())).toEqual([]);
            expect(await zero.run(Task.query().all().onlyTrashed().request())).toHaveLength(1);
            await zero.mutate(Task.restore().prepare({ id: create.args.id })).client;
            expect(await zero.run(Task.query().all().request())).toHaveLength(1);
            await zero.mutate(Task.force_delete().prepare({ id: create.args.id })).client;
            expect(await zero.run(Task.query().all().withTrashed().request())).toEqual([]);
        } finally {
            await zero.close();
        }
    });
});

describe('relation authorization', () => {
    it('hides rows without a related record visible to the current user', async () => {
        const shared = createLaravelZero(schema, {
            ...definitions,
            Task: { ...definitions.Task, authorization: [], authorizationRelations: ['list'] },
            TaskList: {
                ...definitions.TaskList,
                mutations: ['create', 'destroy'],
                writable: ['name'],
                serverFill: { user_id: 'user_id' },
                idGenerator: 'uuid',
            },
        } as const);
        const zero = new Zero<typeof schema, undefined, ClientContext>({
            schema,
            mutators: shared.mutators,
            context: { user_id: 'alice' },
            userID: 'alice',
            cacheURL: null,
            kvStore: 'mem',
            logLevel: 'error',
        });
        try {
            await zero.mutate(shared.models.Task.create().prepare({ title: 'Not yet visible' })).client;
            expect(await zero.run(shared.models.Task.query().all().request())).toEqual([]);
            const list = shared.models.TaskList.create().prepare({ name: 'Accessible list' });
            await zero.mutate(list).client;
            await zero.mutate(shared.models.Task.create().prepare({ title: 'Visible', list_id: list.args.id })).client;
            expect(await zero.run(shared.models.Task.query().all().request())).toMatchObject([{ title: 'Visible' }]);
            await zero.mutate(shared.models.TaskList.destroy().prepare({ id: list.args.id })).client;
            expect(await zero.run(shared.models.Task.query().all().request())).toEqual([]);
        } finally {
            await zero.close();
        }
    });
});

describe('native generated provider lifecycle', () => {
    it('keeps equivalent context and replaces Zero when the tenant changes', async () => {
        const { render, act, cleanup } = await import('@testing-library/react');
        const { createZeroProvider, useZero } = await import('./react');
        const Provider = createZeroProvider(schema, mutators, { cacheURL: null, kvStore: 'mem', logLevel: 'error' });
        let current: Zero<typeof schema, undefined, ClientContext> | undefined;
        function Probe() {
            current = useZero<typeof schema, undefined, ClientContext>();
            return null;
        }
        const tree = (tenant: string) => (
            <Provider userID="alice" context={{ user_id: 'alice', tenant_id: tenant }}>
                <Probe />
            </Provider>
        );
        const host = render(tree('a'));
        const first = current!;
        expect(first).toBeDefined();
        host.rerender(tree('a'));
        expect(current).toBe(first);
        host.rerender(tree('b'));
        expect(current).not.toBe(first);
        await act(async () => {
            await Promise.resolve();
        });
        expect(first.closed).toBe(true);
        cleanup();
    });
});

describe('native atomic nested mutations', () => {
    it('creates dependencies and children together and rolls back a later optimistic failure', async () => {
        const runtime = nestedRuntime();
        const { Task: NestedTask } = runtime.models;
        const zero = new Zero<typeof schema, undefined, ClientContext>({
            schema,
            mutators: runtime.mutators,
            context: { user_id: 'alice' },
            userID: 'nested',
            cacheURL: null,
            kvStore: 'mem',
            logLevel: 'error',
        });
        try {
            const request = NestedTask.create()
                .with('list')
                .with('comments')
                .prepare({ title: 'Root', list: { name: 'List' }, comments: [{ body: 'First' }] });
            expect(await zero.mutate(request).client).toEqual({ type: 'success' });
            const rows = await zero.run(NestedTask.query.all().with('list').with('comments').request());
            expect(rows).toMatchObject([
                {
                    id: request.args.id,
                    list: { name: 'List' },
                    comments: [{ body: 'First', task_id: request.args.id }],
                },
            ]);
            const other = NestedTask.create()
                .with('comments')
                .prepare({ title: 'Other', comments: [{ body: 'Other child' }] });
            expect(await zero.mutate(other).client).toEqual({ type: 'success' });
            const forged = NestedTask.update()
                .with('comments')
                .prepare({
                    id: request.args.id,
                    title: 'Must roll back',
                    comments: [{ id: String(other.args.relations!.comments!.records[0]!.id), body: 'Stolen' }],
                });
            expect((await zero.mutate(forged).client).type).toBe('error');
            expect(await zero.run(NestedTask.query.one(request.args.id).request())).toMatchObject({ title: 'Root' });
            const valid = NestedTask.update()
                .with('comments')
                .prepare({
                    id: request.args.id,
                    comments: [{ id: String(request.args.relations!.comments!.records[0]!.id), body: 'Changed' }],
                });
            expect(await zero.mutate(valid).client).toEqual({ type: 'success' });
            expect(await zero.run(NestedTask.query.one(request.args.id).with('comments').request())).toMatchObject({
                comments: [{ body: 'Changed' }],
            });
        } finally {
            await zero.close();
        }
    });
});
