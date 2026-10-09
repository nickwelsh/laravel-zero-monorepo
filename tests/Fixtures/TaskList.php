<?php

namespace LaravelZero\Tests\Fixtures;

use Illuminate\Database\Eloquent\Model;
use LaravelZero\Attributes\ZeroAuthorize;
use LaravelZero\ContextField;

#[ZeroAuthorize('user_id', '=', ContextField::UserId)]
class TaskList extends Model
{
    protected $table = 'lists';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';
}
