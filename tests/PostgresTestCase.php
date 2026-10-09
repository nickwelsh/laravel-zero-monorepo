<?php

namespace LaravelZero\Tests;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

abstract class PostgresTestCase extends TestCase
{
    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'testing');
        $app['config']->set('database.connections.testing', [
            'driver' => 'pgsql', 'host' => getenv('ZERO_TEST_PG_HOST') ?: '127.0.0.1',
            'port' => getenv('ZERO_TEST_PG_PORT') ?: '5432',
            'database' => getenv('ZERO_TEST_PG_DATABASE') ?: 'laravel_zero_test',
            'username' => getenv('ZERO_TEST_PG_USER') ?: 'postgres',
            'password' => getenv('ZERO_TEST_PG_PASSWORD') ?: '',
            'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer',
        ]);
    }

    protected function setUp(): void
    {
        if (! getenv('ZERO_TEST_PG_DATABASE')) {
            $this->markTestSkipped('Set ZERO_TEST_PG_DATABASE to a dedicated disposable PostgreSQL test database.');
        }
        parent::setUp();
        DB::statement('CREATE SCHEMA zero_test_0');
        DB::statement('CREATE TABLE zero_test_0.clients ("clientGroupID" text, "clientID" text, "lastMutationID" bigint, PRIMARY KEY ("clientGroupID", "clientID"))');
        DB::statement('CREATE TABLE zero_test_0.mutations ("clientGroupID" text, "clientID" text, "mutationID" bigint, result json, PRIMARY KEY ("clientGroupID", "clientID", "mutationID"))');
    }

    protected function tearDown(): void
    {
        if (isset($this->app) && $this->app !== null) {
            DB::statement('DROP SCHEMA IF EXISTS zero_test_0 CASCADE');
            Schema::dropIfExists('tasks');
            Schema::dropIfExists('lists');
        }
        parent::tearDown();
    }
}
