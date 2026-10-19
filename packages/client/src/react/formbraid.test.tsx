// @vitest-environment jsdom
import { createFormbraid, useFieldContext, type FieldProps } from '@formbraid/react';
import type { SubmissionResult } from '@formbraid/core';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { nestedRuntime } from '../../../../tests/interop/nested';
import { useMutation } from './mutation';

const native = vi.hoisted(() => ({ zero: { mutate: vi.fn() } }));
vi.mock('@rocicorp/zero/react', () => ({ useZero: () => native.zero }));
afterEach(cleanup);
beforeEach(() => {
    native.zero.mutate.mockReset();
    native.zero.mutate.mockReturnValue({
        client: Promise.resolve({ type: 'success' }),
        server: Promise.resolve({ type: 'success' }),
    });
});

function TextField({ label }: FieldProps<string | null>) {
    const field = useFieldContext<string | null>();
    return (
        <label>
            {label}
            <input
                name={field.name}
                value={field.value ?? ''}
                onChange={(event) => field.setValue(event.target.value)}
            />
            {field.errors.map((message) => (
                <span role="alert" key={message}>
                    {message}
                </span>
            ))}
        </label>
    );
}
function CheckboxField({ label }: FieldProps<boolean>) {
    const field = useFieldContext<boolean>();
    return (
        <label>
            {label}
            <input type="checkbox" checked={field.value} onChange={(event) => field.setValue(event.target.checked)} />
        </label>
    );
}
function SubmitButton() {
    return <button type="submit">Save</button>;
}
const formbraid = createFormbraid({
    fieldComponents: { TextField, CheckboxField, DateField: TextField },
    formComponents: { SubmitButton },
    submitComponent: 'SubmitButton',
});
const runtime = nestedRuntime();
const context = () => ({ signal: new AbortController().signal, onProgress: () => {} });

describe('Formbraid mutation descriptors', () => {
    it('renders parent and relation fields, keeps edits through rerenders, and maps authoritative nested errors', async () => {
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({ type: 'success' }),
            server: Promise.resolve({
                type: 'error',
                error: { type: 'app', message: 'Invalid', details: { fields: { 'list.name': ['Already taken'] } } },
            }),
        });
        const onResult = vi.fn();
        function Host() {
            const { form } = useMutation(runtime.models.Task.create().with('list'));
            return <formbraid.Form form={form} onResult={onResult} />;
        }
        const view = render(<Host />);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
        expect(native.zero.mutate).not.toHaveBeenCalled();
        const title = screen.getByRole('textbox', { name: /Title/ });
        fireEvent.change(title, { target: { value: 'Party' } });
        fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Person' } });
        view.rerender(<Host />);
        expect(screen.getByRole('textbox', { name: /Title/ })).toBe(title);
        expect((title as HTMLInputElement).value).toBe('Party');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Already taken'));
        expect(native.zero.mutate).toHaveBeenCalledTimes(1);
        expect(native.zero.mutate.mock.lastCall![0].args).toMatchObject({
            data: { title: 'Party' },
            relations: { list: { operation: 'create', records: [{ data: { name: 'Person' } }] } },
        });
        expect(onResult.mock.lastCall![0].status).toBe('invalid');
    });

    it('waits for server acceptance and converts nested date drafts', async () => {
        let accept!: (value: { type: 'success' }) => void;
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({ type: 'success' }),
            server: new Promise((resolve) => {
                accept = resolve;
            }),
        });
        const { result } = renderHook(() =>
            useMutation(runtime.models.Task.create().with('list', 'create', (list) => list.with('tasks'))),
        );
        let pending!: SubmissionResult | PromiseLike<SubmissionResult>;
        let settled = false;
        act(() => {
            pending = result.current.form.submission.submit(
                {
                    title: 'Root',
                    list: { name: 'List', tasks: [{ title: 'Child', completed_at: '2026-10-19T12:00:00Z' }] },
                },
                context(),
            );
            void Promise.resolve(pending).then(() => {
                settled = true;
                return undefined;
            });
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(settled).toBe(false);
        expect(
            native.zero.mutate.mock.lastCall![0].args.relations.list.records[0].relations.tasks.records[0].data
                .completed_at,
        ).toBe(Date.parse('2026-10-19T12:00:00Z'));
        await act(async () => {
            accept({ type: 'success' });
            expect(await pending).toEqual({ status: 'success' });
        });
    });

    it('hydrates bound defaults and lets Formbraid submit only changed fields and child IDs', async () => {
        const task = runtime.models.Task.query
            .all()
            .with('comments')
            .decode([
                {
                    id: 't',
                    title: 'Original',
                    completed_at: 1700000000000,
                    comments: [{ id: 'c', task_id: 't', body: 'Old' }],
                },
            ])[0]!;
        const { result } = renderHook(() => {
            const { form } = useMutation(task.update().with('comments'));
            return formbraid.useForm(form);
        });
        expect(result.current.form.getFieldValue('completed_at')).toBe(new Date(1700000000000).toISOString());
        act(() => result.current.form.setFieldValue('comments.0.body', 'New'));
        await act(async () => {
            expect(await result.current.form.handleSubmit()).toEqual({ status: 'success' });
        });
        expect(native.zero.mutate.mock.lastCall![0].args).toMatchObject({
            id: 't',
            data: {},
            relations: { comments: { records: [{ id: 'c', data: { body: 'New' } }] } },
        });
    });

    it('returns preparation errors without enqueueing and maps transport and application failures', async () => {
        const { result } = renderHook(() => useMutation(runtime.models.Task.create().with('comments')));
        await act(async () => {
            expect(
                await result.current.form.submission.submit(
                    { title: 'Task', comments: [{ body: 'x'.repeat(21) }] },
                    context(),
                ),
            ).toMatchObject({ status: 'invalid', errors: { 'comments.0.body': expect.any(String) } });
            expect(
                await result.current.form.submission.submit({ title: 'Task', completed_at: 'bad date' }, context()),
            ).toMatchObject({ status: 'invalid', errors: { completed_at: expect.any(String) } });
        });
        expect(native.zero.mutate).not.toHaveBeenCalled();
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({ type: 'success' }),
            server: Promise.reject(new Error('Disconnected')),
        });
        await act(async () => {
            expect(await result.current.form.submission.submit({ title: 'Task' }, context())).toMatchObject({
                status: 'failure',
                error: new Error('Disconnected'),
            });
        });
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({ type: 'success' }),
            server: Promise.resolve({ type: 'error', error: { type: 'app', message: 'Denied', details: {} } }),
        });
        await act(async () => {
            expect(await result.current.form.submission.submit({ title: 'Task' }, context())).toMatchObject({
                status: 'failure',
                error: new Error('Denied'),
            });
        });
    });

    it('keeps the mounted defaults when a live record refreshes, preserving untouched remote fields', async () => {
        const { result, rerender } = renderHook(
            ({ title }) => {
                const task = runtime.models.Task.query.all().decode([{ id: 't', title, completed_at: null }])[0]!;
                return formbraid.useForm(useMutation(task.update()).form);
            },
            { initialProps: { title: 'Original' } },
        );
        rerender({ title: 'Remote edit' });
        expect(result.current.form.getFieldValue('title')).toBe('Original');
        act(() => result.current.form.setFieldValue('completed_at', '2026-10-19T12:00:00Z'));
        await act(async () => {
            expect(await result.current.form.handleSubmit()).toEqual({ status: 'success' });
        });
        expect(native.zero.mutate.mock.lastCall![0].args.data).toEqual({
            completed_at: Date.parse('2026-10-19T12:00:00Z'),
        });
    });

    it('settles client failures without waiting forever for the server', async () => {
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({
                type: 'error',
                error: { type: 'app', message: 'Local failure', details: { fields: { title: ['Rejected'] } } },
            }),
            server: new Promise(() => {}),
        });
        const { result } = renderHook(() => useMutation(runtime.models.Task.create()));
        await act(async () => {
            expect(await result.current.form.submission.submit({ title: 'Task' }, context())).toEqual({
                status: 'invalid',
                errors: { title: ['Rejected'] },
            });
        });
    });

    it('cancels observation without claiming the durable mutation was undone', async () => {
        native.zero.mutate.mockReturnValue({
            client: Promise.resolve({ type: 'success' }),
            server: new Promise(() => {}),
        });
        const { result } = renderHook(() => useMutation(runtime.models.Task.create()));
        const controller = new AbortController();
        controller.abort();
        expect(
            await result.current.form.submission.submit({ title: 'Task' }, { ...context(), signal: controller.signal }),
        ).toEqual({ status: 'cancelled' });
        expect(native.zero.mutate).not.toHaveBeenCalled();
        const active = new AbortController();
        await act(async () => {
            const pending = result.current.form.submission.submit(
                { title: 'Task' },
                { ...context(), signal: active.signal },
            );
            active.abort();
            expect(await pending).toEqual({ status: 'cancelled' });
        });
        expect(native.zero.mutate).toHaveBeenCalledTimes(1);
    });
});
