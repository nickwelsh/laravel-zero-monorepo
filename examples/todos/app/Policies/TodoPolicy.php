<?php

namespace App\Policies;

use App\Models\Todo;
use App\Models\User;

class TodoPolicy
{
    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Todo $todo): bool
    {
        return $todo->list->accessibleBy($user);
    }

    public function delete(User $user, Todo $todo): bool
    {
        return $this->update($user, $todo);
    }
}
