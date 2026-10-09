<?php

namespace App\Models;

use App\Http\Requests\SaveTodoListRequest;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LaravelZero\Attributes\ZeroAuthorizeRelation;
use LaravelZero\Attributes\ZeroMutate;
use LaravelZero\Attributes\ZeroQuery;
use LaravelZero\Attributes\ZeroServerFill;
use LaravelZero\ContextField;
use LaravelZero\Definition\ZeroDefinition;

/**
 * @property string $id
 * @property int $user_id
 * @property string $name
 */
#[ZeroQuery(['all', 'one'])]
#[ZeroMutate('create', 'update', 'destroy')]
#[ZeroAuthorizeRelation('memberships')]
#[ZeroServerFill('user_id', ContextField::UserId)]
class TodoList extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'user_id'];

    protected static function booted(): void
    {
        static::created(function (self $list): void {
            $list->memberships()->create(['user_id' => $list->user_id]);
        });
    }

    public static function zero(): ZeroDefinition
    {
        return ZeroDefinition::make()
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
}
