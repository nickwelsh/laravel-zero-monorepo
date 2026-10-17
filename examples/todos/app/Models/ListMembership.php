<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LaravelZero\ContextField;
use LaravelZero\Definition\ZeroDefinition;

/**
 * @property string $id
 * @property string $list_id
 * @property int $user_id
 */
class ListMembership extends Model
{
    use HasUuids;

    protected $fillable = ['list_id', 'user_id'];

    public static function zero(): ZeroDefinition
    {
        return ZeroDefinition::make()->authorize('user_id', '=', ContextField::UserId);
    }
}
