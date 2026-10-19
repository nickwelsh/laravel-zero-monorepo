import { describe, expect, it } from 'vite-plus/test';
import { definitionSchema } from '@formbraid/core';
import { Effect, Schema } from 'effect';
import { nestedDefinitions, nestedRuntime } from '../../../tests/interop/nested';
import { schema } from '../../../tests/interop/generated';
import { createZeroForLaravel } from './runtime';

describe('mutation form metadata', () => {
    it('composes writable relation fields and excludes trusted and linking fields', () => {
        const { models } = nestedRuntime();
        const form = models.Task.create()
            .with('list', 'create', (list) => list.with('tasks'))
            .with('comments').form;
        expect(Object.keys(form.definition.fields)).toEqual([
            'title',
            'done',
            'completed_at',
            'list.name',
            'list.tasks',
            'list.tasks.*.title',
            'list.tasks.*.done',
            'list.tasks.*.completed_at',
            'comments',
            'comments.*.body',
        ]);
        expect(form.definition.fields['comments.*.body']).toMatchObject({
            name: 'comments.*.body',
            component: 'TextField',
            label: 'Body',
            constraints: { required: true, maxLength: 20 },
            serverRules: ['required', 'string', 'max:20'],
        });
        expect(form.definition.defaultValues).toMatchObject({
            title: '',
            done: false,
            completed_at: null,
            list: { name: '', tasks: [] },
            comments: [],
        });
        expect(form.definition.fields).not.toHaveProperty('list_id');
        expect(form.definition.fields).not.toHaveProperty('comments.*.task_id');
        expect(form.definition.fields).not.toHaveProperty('user_id');
        expect(form.definition.fields).not.toHaveProperty('id');
    });

    it('maps casts, enum options, literal defaults, and operation-specific constraints', () => {
        const { models } = createZeroForLaravel(schema, {
            ...nestedDefinitions,
            Task: {
                ...nestedDefinitions.Task,
                columns: {
                    ...nestedDefinitions.Task.columns,
                    title: {
                        ...nestedDefinitions.Task.columns.title,
                        enum: ['small', 'large'],
                        hasDefault: true,
                        default: 'large',
                    },
                    done: {
                        ...nestedDefinitions.Task.columns.done,
                        type: 'string',
                        cast: 'integer',
                        hasDefault: true,
                        default: '4',
                    },
                },
                validation: {
                    create: { title: ['required', 'in:small,large'], done: ['integer', 'min:2', 'max:10'] },
                    update: { title: ['sometimes', 'required'] },
                },
            },
        } as const);
        expect(models.Task.create().form.definition.fields.title).toMatchObject({
            type: 'enum',
            component: 'SelectField',
            constraints: { required: true, options: ['small', 'large'] },
        });
        expect(models.Task.create().form.definition.fields.done).toMatchObject({
            type: 'integer',
            component: 'NumberField',
            constraints: { min: 2, max: 10 },
        });
        expect(models.Task.create().form.definition.defaultValues).toMatchObject({ title: 'large', done: 4 });
        expect(models.Task.update().form.definition.fields.title.constraints.required).toBe(false);
    });

    it('validates missing required nested values using Formbraid constraints', async () => {
        const { models } = nestedRuntime();
        const definition = models.Task.create().with('comments').form.definition;
        const validate = Schema.decodeUnknownEffect(definitionSchema(definition));
        await expect(Effect.runPromise(validate({ title: 'Root', comments: [{}] }))).rejects.toThrow(
            /Body is required/,
        );
        await expect(
            Effect.runPromise(validate({ title: 'Root', comments: [{ body: 'Comment' }] })),
        ).resolves.toMatchObject({ title: 'Root' });
    });

    it('preserves numeric enum ranges and intersects request options with the column enum', () => {
        const { models } = createZeroForLaravel(schema, {
            ...nestedDefinitions,
            Task: {
                ...nestedDefinitions.Task,
                columns: {
                    ...nestedDefinitions.Task.columns,
                    title: { ...nestedDefinitions.Task.columns.title, enum: ['small', 'large'] },
                    done: {
                        ...nestedDefinitions.Task.columns.done,
                        type: 'number',
                        enum: [1, 2, 3],
                        hasDefault: false,
                    },
                },
                validation: { create: { title: ['in:small'], done: ['min:2', 'max:3'] } },
            },
        } as const);
        expect(models.Task.create().form.definition.fields.title.constraints.options).toEqual(['small']);
        expect(models.Task.create().form.definition.fields.done.constraints).toMatchObject({
            min: 2,
            max: 3,
            options: [1, 2, 3],
        });
        expect(models.Task.create().form.definition.defaultValues.done).toBe('');
    });

    it('keeps hydrated IDs as defaults and allows omitted update relations', async () => {
        const { models } = nestedRuntime();
        const definition = models.Task.update().with('list').form.definition;
        const validate = Schema.decodeUnknownEffect(definitionSchema(definition));
        await expect(Effect.runPromise(validate({ id: 't', title: 'Root' }))).resolves.toMatchObject({ id: 't' });
        const row = models.Task.query
            .all()
            .with('comments')
            .decode([
                {
                    id: 't',
                    comments: [
                        { id: 'a', task_id: 't', body: 'First' },
                        { id: 'b', task_id: 't', body: 'Second' },
                    ],
                },
            ])[0]!;
        expect(row.update().with('comments').form.definition.defaultValues.comments).toEqual([
            { id: 'a', body: 'First' },
            { id: 'b', body: 'Second' },
        ]);
    });
});
