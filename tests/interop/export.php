<?php

require __DIR__.'/../../packages/laravel/vendor/autoload.php';

use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\Schema\Blueprint;
use LaravelZero\Generation\TypeScriptGenerator;
use LaravelZero\Metadata\ModelRegistry;
use LaravelZero\Query\QueryCompiler;
use LaravelZero\Tests\Fixtures\Comment;
use LaravelZero\Tests\Fixtures\Tag;
use LaravelZero\Tests\Fixtures\Task;
use LaravelZero\Tests\Fixtures\TaskList;
use LaravelZero\ZeroContext;

$capsule = new Manager;
$capsule->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
$capsule->setAsGlobal();
$capsule->bootEloquent();
$capsule->schema()->create('tasks', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('user_id');
    $table->uuid('list_id')->nullable();
    $table->string('title');
    $table->boolean('done')->default(false);
    $table->timestamp('completed_at')->nullable();
    $table->string('secret')->nullable();
    $table->timestamps();
    $table->softDeletes();
});
$capsule->schema()->create('lists', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('user_id');
    $table->string('name');
});
$capsule->schema()->create('tags', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->string('user_id');
    $table->string('name');
});
$capsule->schema()->create('task_tag', function (Blueprint $table) {
    $table->uuid('task_id');
    $table->uuid('tag_id');
    $table->primary(['task_id', 'tag_id']);
});
$capsule->schema()->create('comments', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->uuid('task_id');
    $table->string('user_id');
    $table->string('body');
});
Container::setInstance($capsule->getContainer());
$registry = new ModelRegistry([Task::class, TaskList::class, Tag::class, Comment::class]);
if (($argv[3] ?? null) === 'scope') {
    $registry->get('Task')->definition->enforceServerScope(fn (\LaravelZero\Query\ZQLBuilder $query) => $query->where(fn (\LaravelZero\Query\ZeroOperator $op) => $op->or($op->cmp('done', true), $op->cmp('title', 'shared'))));
}
if (($argv[1] ?? null) === 'generate') {
    echo (new TypeScriptGenerator)->generate($registry);
} else {
    $args = json_decode($argv[2] ?? '{}', flags: JSON_THROW_ON_ERROR);
    echo json_encode((new QueryCompiler($registry))->compile($argv[1] ?? 'Task.all', $args, new ZeroContext(['user_id' => 'alice'])), JSON_THROW_ON_ERROR);
}
