<?php

namespace App\Policies;

use App\Models\TodoList;
use App\Models\User;

class TodoListPolicy
{
    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, TodoList $list): bool
    {
        return $list->user_id === $user->id;
    }

    public function delete(User $user, TodoList $list): bool
    {
        return $this->update($user, $list);
    }

    public function share(User $user, TodoList $list): bool
    {
        return $this->update($user, $list);
    }
}
