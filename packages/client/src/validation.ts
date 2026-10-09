import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { Column, ModelContract, ContractMap, QueryArgs, ClientContext, Operation } from './contract';

export class InputError extends Error {
    constructor(public readonly fields: Readonly<Record<string, string>>) {
        super(
            Object.entries(fields)
                .map(([field, message]) => `${field}: ${message}`)
                .join('; '),
        );
        this.name = 'InputError';
    }
}

export function fail(field: string, message: string): never {
    throw new InputError({ [field]: message });
}

export function object(value: unknown, path: string): Record<string, unknown> {
    if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    )
        fail(path, 'Expected an object.');
    return value as Record<string, unknown>;
}

export function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(value))
        if (!allowed.includes(key)) fail(`${path}.${key}`, 'Unknown or protected field.');
}

export function columnValue(value: unknown, column: Column, path: string, publicDate = false): ReadonlyJSONValue {
    if (value === null && column.nullable) return null;
    if (column.date && publicDate) {
        if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail(path, 'Expected a valid Date.');
        return value.getTime();
    }
    const valid =
        column.type === 'json'
            ? isJson(value)
            : typeof value === column.type && (column.type !== 'number' || Number.isFinite(value));
    if (!valid || value === null || (column.enum && !column.enum.includes(value as string | number)))
        fail(path, 'Invalid field value.');
    if (column.date && (!Number.isInteger(value) || Math.abs(value as number) > 8640000000000000))
        fail(path, 'Expected epoch milliseconds.');
    return value as ReadonlyJSONValue;
}

function isJson(value: unknown, ancestors = new Set<unknown>()): value is ReadonlyJSONValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object' || ancestors.has(value)) return false;
    if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
    )
        return false;
    ancestors.add(value);
    const valid = Object.values(value).every((v) => isJson(v, ancestors));
    ancestors.delete(value);
    return valid;
}

export function contextValue(ctx: ClientContext, name: string): string | number | boolean {
    const value = ctx[name];
    if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value)))
        fail('context', `Missing context ${name}.`);
    return value;
}

export function validateQueryArgs(
    defs: ContractMap,
    model: ModelContract,
    operation: 'all' | 'one',
    value: unknown,
): QueryArgs {
    const args = object(value, 'args');
    keys(args, operation === 'one' ? ['id', 'include'] : ['filters', 'include', 'order', 'limit'], 'args');
    if (operation === 'one') columnValue(args.id, model.columns[model.key]!, 'id');
    validateRefinement(defs, model, args, 0);
    return args;
}

function validateRefinement(
    defs: ContractMap,
    model: ModelContract,
    args: Record<string, unknown>,
    depth: number,
): void {
    if (depth > 8) fail('include', 'Includes exceed the maximum depth.');
    if (
        args.limit !== undefined &&
        (!Number.isInteger(args.limit) || (args.limit as number) < 1 || (args.limit as number) > model.maxLimit)
    )
        fail('limit', `Limit must be between 1 and ${model.maxLimit}.`);
    if (args.order !== undefined) {
        if (!Array.isArray(args.order)) fail('order', 'Invalid sort order.');
        const used = new Set<string>();
        for (const pair of args.order) {
            if (
                !Array.isArray(pair) ||
                pair.length !== 2 ||
                !model.sorts.includes(pair[0]) ||
                !['asc', 'desc'].includes(pair[1]) ||
                used.has(pair[0])
            )
                fail('order', 'Invalid or disallowed sort.');
            used.add(pair[0]);
        }
    }
    const filters = object(args.filters ?? {}, 'filters');
    keys(filters, Object.keys(model.filters), 'filters');
    for (const [name, value] of Object.entries(filters)) {
        const filter = model.filters[name]!;
        if (filter.kind === 'partial' && typeof value !== 'string') fail(name, 'Expected a string.');
        if (filter.kind === 'trashed') {
            if (!['without', 'with', 'only'].includes(value as string)) fail(name, 'Invalid trashed filter.');
        } else if (filter.kind === 'belongsTo') {
            const target = defs[model.relations[filter.field]!.model]!;
            columnValue(value, target.columns[target.key]!, name);
        } else columnValue(value, model.columns[filter.field]!, name);
    }
    const includes = object(args.include ?? {}, 'include');
    keys(includes, model.includes, 'include');
    for (const [name, spec] of Object.entries(includes)) {
        const relation = model.relations[name]!;
        const refinement = object(spec, `include.${name}`);
        keys(refinement, ['include', 'order', 'limit'], `include.${name}`);
        if (refinement.limit !== undefined && (relation.cardinality === 'one' || relation.path.length > 1))
            fail(name, 'Limits require a direct to-many relation.');
        if (refinement.order !== undefined && relation.path.length > 1) fail(name, 'Junction ordering is unsupported.');
        validateRefinement(defs, defs[relation.model]!, refinement, depth + 1);
    }
}

export function freeze<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

export function validateRules(model: ModelContract, operation: Operation, data: Record<string, unknown>): void {
    for (const [field, rules] of Object.entries(model.validation[operation] ?? {})) {
        const value = data[field];
        if (value === undefined && rules.includes('sometimes')) continue;
        const empty =
            value === undefined ||
            value === null ||
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0);
        if (rules.includes('required') && empty) fail(field, 'This field is required.');
        if (value === undefined || (value === null && rules.includes('nullable')) || value === '') continue;
        for (const rule of rules) {
            const [kind, ...parameters] = rule.split(':');
            const parameter = parameters.join(':');
            const numeric =
                model.columns[field]?.type === 'number' || rules.includes('numeric') || rules.includes('integer');
            const size = numeric
                ? Number(value)
                : typeof value === 'string'
                  ? Array.from(value).length
                  : Array.isArray(value)
                    ? value.length
                    : NaN;
            const valid =
                kind === 'min'
                    ? size >= Number(parameter)
                    : kind === 'max'
                      ? size <= Number(parameter)
                      : kind === 'in'
                        ? (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
                          parameter.split(',').includes(String(value))
                        : kind === 'string'
                          ? typeof value === 'string'
                          : kind === 'boolean'
                            ? typeof value === 'boolean'
                            : kind === 'integer'
                              ? typeof value === 'number' && Number.isInteger(value)
                              : kind === 'numeric'
                                ? (typeof value === 'number' || typeof value === 'string') &&
                                  value !== '' &&
                                  Number.isFinite(Number(value))
                                : kind === 'uuid'
                                  ? typeof value === 'string' &&
                                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
                                  : kind === 'ulid'
                                    ? typeof value === 'string' && /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value)
                                    : true;
            if (!valid) fail(field, `Failed ${rule} validation.`);
        }
    }
}
