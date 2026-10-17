import { definitions, schema } from './generated';
import { createLaravelZero } from '@nickwelsh/laravel-zero';
import type { ClientDefaults } from '@nickwelsh/laravel-zero';

// Exercise nested-only models against the actual PHP-generated tables and columns.
export const nestedDefinitions = {
    ...definitions,
    Task: {
        ...definitions.Task,
        nestedMutations: {
            create: { list: ['create'], comments: ['create'] },
            update: { list: ['update', 'create'], comments: ['create', 'update'] },
        },
        relations: {
            ...definitions.Task.relations,
            list: { ...definitions.Task.relations.list, kind: 'belongsTo' },
            comments: { ...definitions.Task.relations.comments, kind: 'hasMany' },
        },
    },
    TaskList: {
        ...definitions.TaskList,
        idGenerator: 'uuid',
        writable: ['name'],
        serverFill: { user_id: 'user_id' },
        nestedMutations: { create: { tasks: ['create'] } },
        relations: { tasks: { ...definitions.TaskList.relations.tasks, kind: 'hasMany' } },
    },
    Comment: {
        ...definitions.Comment,
        idGenerator: 'uuid',
        writable: ['body', 'task_id'],
        serverFill: { user_id: 'user_id' },
        validation: { create: { body: ['required', 'string', 'max:20'] } },
    },
} as const;

export function nestedRuntime(defaults: ClientDefaults = {}) {
    return createLaravelZero(schema, nestedDefinitions, defaults);
}
