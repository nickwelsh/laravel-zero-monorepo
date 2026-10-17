import { useMutation } from '@laravel-zero/client/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Todo as TodoRecord } from '@/zero/generated';
import { commitMutation } from './mutations';

export function TodoRow({ todo }: { todo: TodoRecord }) {
    const update = useMutation(todo.update());
    const destroy = useMutation(todo.destroy());
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(todo.data.title);
    const pending = update.state.status === 'pending' || destroy.state.status === 'pending';

    return (
        <li className="flex items-center gap-3 rounded-lg border p-3">
            <input
                type="checkbox"
                className="size-4 accent-primary"
                aria-label={`Complete ${todo.data.title}`}
                checked={todo.data.completed}
                disabled={pending}
                onChange={(event) => void commitMutation(() => update({ completed: event.target.checked }))}
            />
            {editing ? (
                <form
                    className="flex min-w-0 flex-1 gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void commitMutation(
                            () => update({ title }),
                            () => setEditing(false),
                        );
                    }}
                >
                    <Input
                        aria-label="Edit todo title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={200}
                        required
                    />
                    <Button size="sm" disabled={pending}>
                        Save
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
                        Cancel
                    </Button>
                </form>
            ) : (
                <span
                    className={`min-w-0 flex-1 break-words ${todo.data.completed ? 'text-muted-foreground line-through' : ''}`}
                >
                    {todo.data.title}
                </span>
            )}
            {!editing && (
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${todo.data.title}`}
                    disabled={pending}
                    onClick={() => {
                        setTitle(todo.data.title);
                        setEditing(true);
                    }}
                >
                    <Pencil className="size-4" />
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${todo.data.title}`}
                disabled={pending}
                onClick={() => void commitMutation(() => destroy({}))}
            >
                <Trash2 className="size-4" />
            </Button>
        </li>
    );
}
