<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LaravelZero\Attributes\ZeroAuthorize;
use LaravelZero\ContextField;

/**
 * @property string $id
 * @property string $list_id
 * @property int $user_id
 */
#[ZeroAuthorize('user_id', '=', ContextField::UserId)]
class ListMembership extends Model
{
    use HasUuids;

    protected $fillable = ['list_id', 'user_id'];
}
