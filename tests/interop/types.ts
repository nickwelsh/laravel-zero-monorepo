import { Task, TaskList, schema, definitions } from './generated';
import { createLaravelZero } from '@laravel-zero/client';
import type { SelectionData } from '@laravel-zero/client';
import {
    useData,
    useFilter,
    useMutation,
    useFilters,
    type FilterControls,
    type FilterControlProps,
} from '@laravel-zero/client/react';
import type { ComponentType } from 'react';

// Compiled by typecheck; these are public-contract checks, not runtime tests.
function useContracts() {
    const selection = Task.query().all().with('list');
    const data = useData(selection);
    const selected: SelectionData<typeof selection> = data.data;
    const date: Date | null | undefined = data.data[0]?.data.completed_at;
    const name: string | undefined = data.data[0]?.data.list?.data.name;
    const one = useData(Task.query().one('id').with('list'));
    const title: string | undefined = one.data?.data.title;
    const mutation = useMutation(Task.create());
    mutation({ title: 'Hello', completed_at: new Date() });
    const BooleanControl: ComponentType<FilterControlProps<boolean>> = () => null;
    const SharedBooleanControl: ComponentType<FilterControlProps<boolean | null>> = () => null;
    const controls: FilterControls = { boolean: SharedBooleanControl };
    useFilter(Task, 'done', { component: BooleanControl });
    Task.query()
        .all()
        .filters([
            { model: 'Task', name: 'done', value: false },
            { model: 'Task', name: 'title', value: 'Hello' },
        ]);
    const [filters] = useFilters(Task, ['done', 'title']);
    Task.query().all().filters(filters);
    Task.query()
        .all()
        .filters([
            // @ts-expect-error filter names and values stay correlated in filter arrays
            { model: 'Task', name: 'done', value: 'false' },
        ]);
    // @ts-expect-error wrong custom control value contract
    useFilter(Task, 'title', { component: BooleanControl });
    // @ts-expect-error only declared filters are available
    useFilter(Task, 'secret');
    // @ts-expect-error singular queries cannot paginate
    Task.query().one('id').infinite();
    // @ts-expect-error to-one includes cannot have a limit
    Task.query().all().with('list', 5);
    // @ts-expect-error junction includes cannot have a limit
    Task.query().all().with('tags', 5);
    Task.query().all().with('comments', 5);
    const nested = useData(
        Task.query()
            .all()
            .with('list', (list) => list.with('tasks', 2)),
    );
    const nestedDate: Date | null | undefined = nested.data[0]?.data.list?.data.tasks[0]?.data.created_at;
    Task.query()
        .all()
        .with('list', (list) => {
            // @ts-expect-error nested to-one includes cannot have limits either
            return list.limit(2);
        });
    Task.query()
        .all()
        .with('list', (list) => {
            // @ts-expect-error nested includes remain opt-in
            return list.with('user');
        });
    // @ts-expect-error queries are opt-in
    TaskList.query().all();
    // @ts-expect-error mutations are opt-in
    TaskList.create();
    // @ts-expect-error undeclared relations cannot be included
    Task.query().all().with('user');
    // @ts-expect-error server-filled ownership cannot be supplied
    Task.create().prepare({ title: 'Hello', user_id: 'alice' });
    // @ts-expect-error Date input cannot be supplied as a wire number
    Task.create().prepare({ title: 'Hello', completed_at: 1700000000 });
    // @ts-expect-error create requires title
    Task.create().prepare({});
    // @ts-expect-error hidden columns are absent from public rows
    data.data[0]?.secret;
    // @ts-expect-error undeclared sorts are absent
    Task.query().all().orderBy('secret');
    // @ts-expect-error boolean filters do not accept string values
    Task.query().all().filter({ model: 'Task', name: 'done', value: 'false' });
    return { date, name, title };
}

function useBoundContracts() {
    const task = useData(Task.query().all().with('list')).data[0]!;
    const update = useMutation(task.update());
    update({ completed_at: new Date() });
    update.form.setValue('title', 'Changed');
    const defaults: string | undefined = update.defaultValues.title;
    const list = useData(task.list);
    const name: string | undefined = list.data?.data.name;
    useMutation(task.destroy()).submit();
    // @ts-expect-error bound operations cannot change their record identity
    update({ id: 'forged' });
    // @ts-expect-error relations that were not included are not present in data
    task.data.tags;
    // @ts-expect-error columns live under data
    task.title;
    return { defaults, name };
}

declare module '@laravel-zero/client' {
    interface ModelTypes {
        Task: { preferences: { theme: 'light' | 'dark' } };
    }
}

function useDtoContracts() {
    const runtime = createLaravelZero(schema, {
        ...definitions,
        Task: {
            ...definitions.Task,
            writable: ['title', 'preferences'],
            columns: { ...definitions.Task.columns, preferences: { ...definitions.Task.columns.title, type: 'json' } },
        },
    } as const);
    const task = useData(runtime.models.Task.query.all()).data[0]!;
    const theme: 'light' | 'dark' = task.data.preferences.theme;
    task.update().prepare({ preferences: { theme: 'dark' } });
    // @ts-expect-error DTO field types refine mutation inputs as well as result data
    task.update().prepare({ preferences: { theme: 'unknown' } });
    Task.query.all().filter({ model: 'Task', name: 'completed_after', value: new Date() });
    Task.query.all().filter({ model: 'Task', name: 'title_operator', value: { operator: '!=', value: 'hidden' } });
    // @ts-expect-error dynamic operators retain the column's value type
    Task.query.all().filter({ model: 'Task', name: 'title_operator', value: { operator: '!=', value: 1 } });
    return theme;
}
