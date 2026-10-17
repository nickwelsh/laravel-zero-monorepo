<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Requests\SaveTodoRequest;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LaravelZero\Attributes\ZeroMutate;
use LaravelZero\Attributes\ZeroQuery;
use LaravelZero\Definition\AllowedFilter;
use LaravelZero\Definition\ZeroDefinition;

/**
 * @property string $id
 * @property string $list_id
 * @property string $title
 * @property bool $completed
 * @property-read TodoList $list
 */
#[ZeroQuery(['all', 'one'])]
#[ZeroMutate('create', 'update', 'destroy')]
class Todo extends Model
{
    use HasUuids;

    protected $fillable = ['list_id', 'title', 'completed'];

    public static function zero(): ZeroDefinition
    {
        return ZeroDefinition::make()->authorizeRelation('list')
            ->allowedFilters([AllowedFilter::exact('list_id'), AllowedFilter::exact('completed')])
            ->allowedIncludes(['list'])
            ->allowedSorts(['created_at', 'title', 'completed'])
            ->defaultSort('created_at')
            ->mutationRequests(['create' => SaveTodoRequest::class, 'update' => SaveTodoRequest::class]);
    }

    /** @return BelongsTo<TodoList, $this> */
    public function list(): BelongsTo
    {
        return $this->belongsTo(TodoList::class, 'list_id');
    }

    protected function casts(): array
    {
        return ['completed' => 'boolean'];
    }
}
