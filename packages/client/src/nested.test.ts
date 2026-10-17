import { describe, expect, it } from 'vite-plus/test';
import { nestedRuntime } from '../../../tests/interop/nested';
import { InputError } from './validation';

const id = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('nested mutation preparation', () => {
    it('prepares stable IDs once and preserves a single immutable mutation envelope', () => {
        let ids = 0,
            ticks = 0;
        const { models } = nestedRuntime({ id: () => id(++ids), now: () => new Date(++ticks) });
        const operation = models.Task.create().with('list').with('comments');
        const request = operation.prepare({
            title: 'Task',
            list: { name: 'List' },
            comments: [{ body: 'One' }, { body: 'Two' }],
        });
        expect(ids).toBe(4);
        expect(ticks).toBe(1);
        expect(request.args).toEqual({
            id: id(1),
            data: { title: 'Task' },
            now: 1,
            relations: {
                list: { operation: 'create', records: [{ id: id(2), data: { name: 'List' }, now: 1 }] },
                comments: {
                    operation: 'create',
                    records: [
                        { id: id(3), data: { body: 'One' }, now: 1 },
                        { id: id(4), data: { body: 'Two' }, now: 1 },
                    ],
                },
            },
        });
        expect(Object.isFrozen(request.args.relations!.comments!.records[0]!.data)).toBe(true);
        expect(operation.form.fields).toEqual(['title', 'done', 'completed_at', 'list.name', 'comments.*.body']);
        expect(operation.form.columns['list.name']?.type).toBe('string');
        expect('create' in models.TaskList).toBe(false);
    });

    it('supports deeper explicit selections and omitted relation payloads', () => {
        let ids = 0;
        const { models } = nestedRuntime({ id: () => id(++ids) });
        const operation = models.Task.create().with('list', 'create', (list) => list.with('tasks'));
        const request = operation.prepare({ title: 'Root', list: { name: 'List', tasks: [{ title: 'Child' }] } });
        expect(request.args.relations!.list!.records[0]!.relations!.tasks!.records[0]!.data).toEqual({
            title: 'Child',
        });
        expect(models.Task.create().with('comments').prepare({ title: 'Alone' }).args.relations).toBeUndefined();
        expect(
            models.Task.update()
                .with('comments', 'create')
                .prepare({ id: id(1), comments: [{ body: 'New' }] }).args.relations!.comments!.operation,
        ).toBe('create');
    });

    it('prefixes nested errors and rejects forged linking keys or undeclared operations', () => {
        const { models } = nestedRuntime();
        try {
            models.Task.create()
                .with('comments')
                .prepare({ title: 'Task', comments: [{ body: 'x'.repeat(21) }] });
            expect.fail('Expected validation error');
        } catch (error) {
            expect(error).toBeInstanceOf(InputError);
            expect((error as InputError).fields).toHaveProperty('comments.0.body');
        }
        expect(() =>
            models.Task.create()
                .with('comments')
                .prepare({ title: 'Task', comments: [{ body: 'x', task_id: id(3) }] } as never),
        ).toThrow(/protected/);
        expect(() =>
            models.Task.create()
                .with('list')
                .prepare({ title: 'Task', list_id: id(3), list: { name: 'List' } } as never),
        ).toThrow(/protected/);
        expect(() => models.Task.create().with('comments', 'update' as never)).toThrow(/not allowed/);
        expect(() => models.Task.create().with('tags' as never)).toThrow(/not allowed/);
        expect(() =>
            models.Task.create()
                .with('comments')
                .prepare({ title: 'Task', comments: null } as never),
        ).toThrow();
    });

    it('rejects duplicate IDs and excessive graphs before enqueueing', () => {
        const { models } = nestedRuntime({ id: () => id(1) });
        expect(() =>
            models.Task.create()
                .with('comments')
                .prepare({ title: 'Task', comments: [{ body: 'One' }, { body: 'Two' }] }),
        ).toThrow(/once/);
        expect(() =>
            nestedRuntime()
                .models.Task.create()
                .with('comments')
                .prepare({ title: 'Task', comments: Array.from({ length: 100 }, () => ({ body: 'x' })) }),
        ).toThrow(/record count/);
    });
});
