import { useData, useMutation } from '@laravel-zero/client/react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Todo } from '@/zero/generated';
import { commitMutation } from './mutations';
import { TodoRow } from './todo-row';

export function ListTodos({ listId }: { listId: string }) {
    const todos = useData(Todo.query().all().filter({ model: 'Todo', name: 'list_id', value: listId }).infinite(50));
    const create = useMutation(Todo.create());
    const [title, setTitle] = useState('');

    return (
        <div className="space-y-4">
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void commitMutation(
                        () => create({ list_id: listId, title }),
                        () => setTitle(''),
                    );
                }}
            >
                <Input
                    aria-label="New todo"
                    placeholder="What needs doing?"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    maxLength={200}
                />
                <Button disabled={create.state.status === 'pending'}>Add todo</Button>
            </form>
            <InputError message={create.state.fields.title?.join(' ')} />
            {todos.error && (
                <div role="alert" className="text-sm text-destructive">
                    {todos.error.message}{' '}
                    <Button variant="link" onClick={() => todos.retry()}>
                        Retry
                    </Button>
                </div>
            )}
            {todos.status === 'loading' && <p className="text-sm text-muted-foreground">Loading todos…</p>}
            {todos.complete && todos.data.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Nothing to do yet. Add the first todo above.
                </p>
            )}
            <ul className="space-y-2">
                {todos.data.map((todo) => (
                    <TodoRow key={todo.data.id} todo={todo} />
                ))}
            </ul>
            {todos.infinite?.hasMore && (
                <Button variant="outline" onClick={() => todos.infinite?.loadMore()}>
                    Load more todos
                </Button>
            )}
        </div>
    );
}
