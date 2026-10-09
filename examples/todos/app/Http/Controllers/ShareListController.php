<?php

namespace App\Http\Controllers;

use App\Http\Requests\ShareListRequest;
use App\Models\TodoList;
use App\Models\User;
use Illuminate\Http\RedirectResponse;

class ShareListController extends Controller
{
    public function __invoke(ShareListRequest $request, TodoList $list): RedirectResponse
    {
        $user = User::where('email', $request->string('email')->toString())->firstOrFail();
        $list->memberships()->firstOrCreate(['user_id' => $user->id]);

        return back()->with('success', "List shared with {$user->name}.");
    }
}
