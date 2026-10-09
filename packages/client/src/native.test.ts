// @vitest-environment jsdom
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
            await zero.mutate(
                Task.update().prepare({
                    id: create.args.id,
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
            await zero.mutate(Task.destroy().prepare({ id: create.args.id })).client;
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
