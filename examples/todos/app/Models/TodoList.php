<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Requests\SaveTodoListRequest;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use ZeroForLaravel\Attributes\ZeroMutate;
use ZeroForLaravel\Attributes\ZeroQuery;
use ZeroForLaravel\ContextField;
use ZeroForLaravel\Definition\ZeroDefinition;

/**
 * @property string $id
 * @property int $user_id
 * @property string $name
 */
#[ZeroQuery(['all', 'one'])]
#[ZeroMutate('create', 'update', 'destroy')]
class TodoList extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'user_id'];

    public static function zero(): ZeroDefinition
    {
        return ZeroDefinition::make()->authorizeRelation('memberships')->fillFromContext('user_id', ContextField::UserId)
            ->allowedIncludes(['todos'])
            ->allowedSorts(['name', 'created_at'])
            ->defaultSort('name')
            ->mutationRequests(['create' => SaveTodoListRequest::class, 'update' => SaveTodoListRequest::class]);
    }

    /** @return HasMany<ListMembership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(ListMembership::class, 'list_id');
    }

    /** @return HasMany<Todo, $this> */
    public function todos(): HasMany
    {
        return $this->hasMany(Todo::class, 'list_id');
    }

    public function accessibleBy(User $user): bool
    {
        return $this->memberships()->where('user_id', $user->id)->exists();
    }

    protected static function booted(): void
    {
        static::created(function (self $list): void {
            $list->memberships()->create(['user_id' => $list->user_id]);
        });
    }
}
