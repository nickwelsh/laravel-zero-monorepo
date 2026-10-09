<?php

namespace LaravelZero\Tests\Feature;

use Illuminate\Database\Eloquent\Model;
use LaravelZero\Attributes\ZeroExclude;
use LaravelZero\Attributes\ZeroPublic;
use LaravelZero\Metadata\ModelRegistry;
use LaravelZero\Tests\Fixtures\Task;
use LaravelZero\Tests\Fixtures\TaskList;
use LaravelZero\Tests\TestCase;
use LogicException;

class MetadataTest extends TestCase
{
    public function test_resolves_one_column_plan_and_separate_public_mutation_inputs(): void
    {
        $registry = new ModelRegistry([Task::class, TaskList::class]);
        $task = $registry->get('Task');
        self::assertArrayNotHasKey('secret', $task->columns);
        self::assertSame('uuid', $task->idGenerator);
        self::assertTrue($task->columns['completed_at']['date']);
        self::assertSame('boolean', $task->columns['done']['type']);
        self::assertSame(false, $task->columns['done']['default']);
        self::assertSame(['list_id', 'title', 'done', 'completed_at'], $task->writable);
        self::assertSame(['user_id' => 'user_id'], $task->serverFill);
        self::assertSame('TaskList', $task->relations['list']['model']);
        self::assertSame('one', $task->relations['list']['cardinality']);
    }

    public function test_reads_fail_closed_without_an_explicit_visibility_declaration(): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('visibility');
        new ModelRegistry([UnprotectedTask::class]);
    }

    public function test_hidden_relation_keys_are_not_silently_republished(): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('list_id');
        new ModelRegistry([HiddenRelationTask::class, TaskList::class]);
    }

    public function test_exclusions_are_additive_to_eloquent_hidden_columns(): void
    {
        $task = (new ModelRegistry([ExcludedTask::class]))->get('ExcludedTask');
        self::assertArrayNotHasKey('secret', $task->columns);
        self::assertArrayNotHasKey('completed_at', $task->columns);
    }
}

class UnprotectedTask extends Model
{
    protected $table = 'tasks';
}

class HiddenRelationTask extends Task
{
    protected $hidden = ['secret', 'list_id'];
}

#[ZeroPublic]
#[ZeroExclude(['completed_at'])]
class ExcludedTask extends Model
{
    protected $table = 'tasks';

    protected $hidden = ['secret'];
}
