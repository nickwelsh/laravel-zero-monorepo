<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveTodoListRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The automatic CRUD executor has already checked the operation policy.
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return ['name' => ['sometimes', 'required', 'string', 'max:100']];
    }
}
