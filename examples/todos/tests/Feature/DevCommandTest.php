<?php

use Illuminate\Foundation\DevCommands;

test('the dev command runs Vite and Zero alongside queue and logs while Herd serves HTTP', function () {
    $this->artisan('dev:list --json')->assertSuccessful();
    $commands = collect(DevCommands::commands())->pluck('command', 'name');

    expect($commands->get('zero'))->toBe('pnpm run zero:dev')
        ->and($commands->get('vite'))->toBe('pnpm run dev')
        ->and($commands->has('queue'))->toBeTrue()
        ->and($commands->has('logs'))->toBeTrue()
        ->and($commands->has('server'))->toBeFalse();
});
