<?php

use App\Models\ListMembership;
use App\Models\Todo;
use App\Models\TodoList;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use LaravelZero\Metadata\ModelRegistry;
use LaravelZero\Mutation\CrudExecutor;
use LaravelZero\Query\QueryCompiler;
use LaravelZero\ZeroContext;

function todosExecutor(): CrudExecutor
{
    return new CrudExecutor(new ModelRegistry([TodoList::class, Todo::class, ListMembership::class]));
}

function todosContext(User $user): ZeroContext
{
    return new ZeroContext(['user_id' => $user->id]);
}

test('creating a list adds its owner as a member', function () {
    $owner = User::factory()->create();
    todosExecutor()->execute('TodoList.create', [
        'id' => '019a0000-0000-7000-8000-000000000001', 'data' => ['name' => 'Home'], 'now' => 1,
    ], todosContext($owner), $owner);
    $list = TodoList::firstOrFail();
    expect($list->user_id)->toBe($owner->id);
    $this->assertDatabaseHas('list_memberships', ['list_id' => $list->id, 'user_id' => $owner->id]);
});

test('only the owner may delete or share a list', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $list = TodoList::create(['name' => 'Home', 'user_id' => $owner->id]);
    $list->memberships()->create(['user_id' => $member->id]);
    expect(Gate::forUser($owner)->allows('delete', $list))->toBeTrue();
    expect(Gate::forUser($member)->allows('delete', $list))->toBeFalse();
    expect(Gate::forUser($member)->allows('share', $list))->toBeFalse();
    todosExecutor()->execute('TodoList.destroy', ['id' => $list->id, 'data' => [], 'now' => 1], todosContext($member), $member);
})->throws(AuthorizationException::class);

test('a shared member can add edit and delete todos', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $list = TodoList::create(['name' => 'Shared', 'user_id' => $owner->id]);
    $list->memberships()->create(['user_id' => $member->id]);
    $executor = todosExecutor();
    $id = '019a0000-0000-7000-8000-000000000002';
    $executor->execute('Todo.create', ['id' => $id, 'data' => ['list_id' => $list->id, 'title' => 'Milk'], 'now' => 1], todosContext($member), $member);
    $executor->execute('Todo.update', ['id' => $id, 'data' => ['title' => 'Oat milk', 'completed' => true], 'now' => 1], todosContext($member), $member);
    $this->assertDatabaseHas('todos', ['id' => $id, 'title' => 'Oat milk', 'completed' => true]);
    $executor->execute('Todo.destroy', ['id' => $id, 'data' => [], 'now' => 1], todosContext($member), $member);
    $this->assertDatabaseMissing('todos', ['id' => $id]);
});

test('outsiders cannot add todos to a private list', function () {
    $owner = User::factory()->create();
    $outsider = User::factory()->create();
    $list = TodoList::create(['name' => 'Private', 'user_id' => $owner->id]);
    todosExecutor()->execute('Todo.create', [
        'id' => '019a0000-0000-7000-8000-000000000003', 'data' => ['list_id' => $list->id, 'title' => 'Attack'], 'now' => 1,
    ], todosContext($outsider), $outsider);
})->throws(AuthorizationException::class);

test('members cannot move a todo to a list they cannot access', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $shared = TodoList::create(['name' => 'Shared', 'user_id' => $owner->id]);
    $private = TodoList::create(['name' => 'Private', 'user_id' => $owner->id]);
    $shared->memberships()->create(['user_id' => $member->id]);
    $todo = Todo::create(['list_id' => $shared->id, 'title' => 'Milk']);
    todosExecutor()->execute('Todo.update', ['id' => $todo->id, 'data' => ['list_id' => $private->id], 'now' => 1], todosContext($member), $member);
})->throws(AuthorizationException::class);

test('todo titles are validated for automatic CRUD', function () {
    $owner = User::factory()->create();
    $list = TodoList::create(['name' => 'Home', 'user_id' => $owner->id]);
    todosExecutor()->execute('Todo.create', [
        'id' => '019a0000-0000-7000-8000-000000000004', 'data' => ['list_id' => $list->id, 'title' => ''], 'now' => 1,
    ], todosContext($owner), $owner);
})->throws(ValidationException::class);

test('an owner can share with a registered email and repeated sharing is safe', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $list = TodoList::create(['name' => 'Home', 'user_id' => $owner->id]);
    $this->actingAs($owner)->post(route('lists.share', $list), ['email' => $member->email])->assertRedirect();
    $this->actingAs($owner)->post(route('lists.share', $list), ['email' => $member->email])->assertRedirect();
    expect($list->memberships()->where('user_id', $member->id)->count())->toBe(1);
});

test('sharing rejects nonmembers and unknown accounts', function () {
    $owner = User::factory()->create();
    $outsider = User::factory()->create();
    $list = TodoList::create(['name' => 'Home', 'user_id' => $owner->id]);
    $this->actingAs($outsider)->post(route('lists.share', $list), ['email' => $owner->email])->assertForbidden();
    $this->actingAs($owner)->post(route('lists.share', $list), ['email' => 'missing@example.com'])->assertSessionHasErrors('email');
});

test('deleting a list cascades its todos and memberships', function () {
    $owner = User::factory()->create();
    $list = TodoList::create(['name' => 'Home', 'user_id' => $owner->id]);
    Todo::create(['list_id' => $list->id, 'title' => 'Milk']);
    todosExecutor()->execute('TodoList.destroy', ['id' => $list->id, 'data' => [], 'now' => 1], todosContext($owner), $owner);
    $this->assertDatabaseCount('todos', 0);
    $this->assertDatabaseCount('list_memberships', 0);
});

test('generated queries enforce membership at both list and todo roots', function () {
    $owner = User::factory()->create();
    $compiler = new QueryCompiler(new ModelRegistry([TodoList::class, Todo::class, ListMembership::class]));
    $list = $compiler->compile('TodoList.all', [], todosContext($owner));
    $todo = $compiler->compile('Todo.all', [], todosContext($owner));
    expect(data_get($list, 'where.related.subquery.where.right.value'))->toBe($owner->id);
    expect(data_get($todo, 'where.related.subquery.where.related.subquery.where.right.value'))->toBe($owner->id);
});
