<?php

declare(strict_types=1);

use App\Models\ListMembership;
use App\Models\Todo;
use App\Models\TodoList;
use LaravelZero\Http\ContextResolver;

return [
    // Empty discovers explicitly annotated models under app/Models.
    'models' => [TodoList::class, Todo::class, ListMembership::class],
    'output' => resource_path('js/zero/generated.ts'),
    'publication' => env('ZERO_PUBLICATION', 'laravel_zero'),
    'app_id' => env('ZERO_APP_ID', 'zero'),
    'upstream_schema' => env('ZERO_UPSTREAM_SCHEMA', 'zero_0'),
    'api_key' => env('ZERO_API_KEY'),
    'route_prefix' => 'zero',
    'middleware' => ['web', 'auth'],
    // Bind this class (or replace it) to add trusted tenant context.
    'context_resolver' => ContextResolver::class,
];
