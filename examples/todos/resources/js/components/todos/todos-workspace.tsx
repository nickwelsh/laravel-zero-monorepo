import { useData, useMutation } from '@nickwelsh/laravel-zero/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TodoList } from '@/zero/generated';
import { ListPanel } from './list-panel';
import { commitMutation } from './mutations';

export function TodosWorkspace({ userId }: { userId: number }) {
    const lists = useData(TodoList.query().all().infinite(50));
    const create = useMutation(TodoList.create());
    const [name, setName] = useState('');
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const selected = lists.data.find((list) => list.data.id === selectedId) ?? lists.data[0];
    const online = lists.connection.name === 'connected';

    return (
        <div className="space-y-6 p-4 md:p-6">
            <header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
                    <output className="text-sm text-muted-foreground">
                        {online ? 'Live sync connected' : 'Connecting to live sync…'}
                    </output>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">A few things to do, together.</p>
            </header>
            {lists.error && (
                <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
                    {lists.error.message}{' '}
                    <Button variant="link" onClick={() => lists.retry()}>
                        Retry
                    </Button>
                </div>
            )}
            <div className="grid items-start gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
                <aside aria-label="Todo lists" className="space-y-4 rounded-xl border bg-card p-4">
                    <h2 className="font-semibold">Your lists</h2>
                    <form
                        className="space-y-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void commitMutation(
                                () => create({ name }),
                                (id) => {
                                    setName('');
                                    setSelectedId(String(id));
                                },
                            );
                        }}
                    >
                        <Input
                            aria-label="New list name"
                            placeholder="New list name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            required
                            maxLength={100}
                        />
                        <Button className="w-full" disabled={create.state.status === 'pending'}>
                            {create.state.status === 'pending' ? 'Creating…' : 'Create list'}
                        </Button>
                        <InputError message={create.state.fields.name?.join(' ')} />
                    </form>
                    {lists.status === 'loading' && <p className="text-sm text-muted-foreground">Loading lists…</p>}
                    <nav aria-label="Choose a list" className="space-y-1">
                        {lists.data.map((list) => (
                            <Button
                                key={list.data.id}
                                variant={list.data.id === selected?.data.id ? 'secondary' : 'ghost'}
                                className="w-full justify-start"
                                aria-current={list.data.id === selected?.data.id ? 'true' : undefined}
                                onClick={() => setSelectedId(list.data.id)}
                            >
                                <span className="truncate">{list.data.name}</span>
                                {list.data.user_id !== userId && (
                                    <span className="ml-auto text-xs text-muted-foreground">Shared</span>
                                )}
                            </Button>
                        ))}
                    </nav>
                    {lists.infinite?.hasMore && (
                        <Button variant="outline" className="w-full" onClick={() => lists.infinite?.loadMore()}>
                            Load more lists
                        </Button>
                    )}
                </aside>
                {selected ? (
                    <ListPanel key={selected.data.id} list={selected} userId={userId} />
                ) : (
                    <section className="rounded-xl border border-dashed p-10 text-center">
                        <h2 className="font-medium">Your next list starts here</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Create a list, then invite someone to help with it.
                        </p>
                    </section>
                )}
            </div>
        </div>
    );
}
