import { Form } from '@inertiajs/react';
import { useMutation } from '@laravel-zero/client/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TodoList } from '@/zero/generated';
import { ListTodos } from './list-todos';
import { commitMutation } from './mutations';

export function ListPanel({ list, userId }: { list: TodoList; userId: number }) {
    const destroy = useMutation(list.destroy());
    const update = useMutation(list.update());
    const [renaming, setRenaming] = useState(false);
    const [name, setName] = useState(list.data.name);
    const owner = list.data.user_id === userId;

    return (
        <section aria-label={`${list.data.name} todos`} className="min-w-0 space-y-6 rounded-xl border bg-card p-5">
            <header className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold">{list.data.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {owner ? 'Your list' : 'Shared with you'} · Everyone with access can edit todos.
                    </p>
                </div>
                {owner && (
                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Rename list"
                            onClick={() => {
                                setName(list.data.name);
                                setRenaming(true);
                            }}
                        >
                            <Pencil className="size-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Delete list"
                            disabled={destroy.state.status === 'pending'}
                            onClick={() => {
                                if (window.confirm(`Delete “${list.data.name}” and all its todos?`))
                                    void commitMutation(() => destroy({}));
                            }}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                )}
            </header>
            {renaming && (
                <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void commitMutation(
                            () => update({ name }),
                            () => setRenaming(false),
                        );
                    }}
                >
                    <Input
                        aria-label="List name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        maxLength={100}
                    />
                    <Button disabled={update.state.status === 'pending'}>Save name</Button>
                    <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                        Cancel
                    </Button>
                </form>
            )}
            <ListTodos listId={list.data.id} />
            {owner && (
                <div className="border-t pt-5">
                    <Form
                        action={`/lists/${list.data.id}/share`}
                        method="post"
                        resetOnSuccess
                        onSuccess={() => toast.success('List shared.')}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing, errors }) => (
                            <div className="space-y-2">
                                <Label htmlFor={`share-${list.data.id}`}>Share with a registered user</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id={`share-${list.data.id}`}
                                        name="email"
                                        type="email"
                                        placeholder="friend@example.com"
                                        required
                                    />
                                    <Button variant="outline" disabled={processing}>
                                        Share list
                                    </Button>
                                </div>
                                <InputError message={errors.email} />
                            </div>
                        )}
                    </Form>
                </div>
            )}
        </section>
    );
}
