import { Head, usePage } from '@inertiajs/react';
import { TodosWorkspace } from '@/components/todos/todos-workspace';
import { dashboard } from '@/routes';
import { TodosZeroProvider } from '@/zero/provider';

export default function Dashboard() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Todos" />
            <TodosZeroProvider userId={auth.user.id}>
                <TodosWorkspace userId={auth.user.id} />
            </TodosZeroProvider>
        </>
    );
}

Dashboard.layout = { breadcrumbs: [{ title: 'Todos', href: dashboard() }] };
