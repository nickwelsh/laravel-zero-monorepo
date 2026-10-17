import type { Schema } from '@rocicorp/zero';
import type { ContractMap, IncludeName, ModelContract, ModelRow, QueryArgs, RelatedName } from './contract';
import { Mutation, type ClientDefaults, type NativeMutators } from './mutation';
import { Selection, type NativeQueries } from './query';
import { fail, decodeColumn } from './validation';

type Data<S extends Schema, D extends ContractMap, N extends keyof D & string, Row> = {
    readonly [K in keyof Row]: K extends keyof D[N]['relations'] & string
        ? D[N]['relations'][K]['cardinality'] extends 'many'
            ? Row[K] extends readonly (infer Child)[]
                ? readonly ModelInstance<S, D, RelatedName<D, N, K>, Child>[]
                : never
            : ModelInstance<S, D, RelatedName<D, N, K>, Exclude<Row[K], undefined>> | undefined
        : Row[K];
};

export class ModelSnapshot<T> {
    constructor(readonly data: T) {
        Object.freeze(data);
    }
}

export type ModelInstance<
    S extends Schema,
    D extends ContractMap,
    N extends keyof D & string,
    Row = ModelRow<D, N>,
> = ModelSnapshot<Data<S, D, N, Row>> & {
    readonly [O in Exclude<D[N]['mutations'][number], 'create'>]: () => Mutation<S, D, N, O, true>;
} & {
    readonly [R in 'one' extends D[N]['queries'][number] ? IncludeName<D, N> : never]: RelationSelection<S, D, N, R>;
};

/** Project a relation from an authorized parent query; never issue an unrestricted target query. */
export class RelationSelection<
    S extends Schema,
    D extends ContractMap,
    N extends keyof D & string,
    R extends IncludeName<D, N>,
> {
    readonly pageSize = undefined;
    readonly one: boolean;
    readonly args: Readonly<QueryArgs>;
    readonly key: string;
    readonly contract: D[N];
    private readonly parent: Selection<S, D, N, ModelRow<D, N>, true>;
    constructor(
        schema: S,
        definitions: D,
        name: N,
        queries: NativeQueries<S, D>,
        id: string | number,
        readonly relation: R,
        defaults: ClientDefaults,
        mutators: NativeMutators<S, D>,
    ) {
        if (!definitions[name]!.queries.includes('one'))
            fail('relation', 'Lazy relations require the parent one query.');
        this.parent = new Selection(
            schema,
            definitions,
            name,
            queries,
            true,
            { id, include: { [relation]: {} } },
            undefined,
            defaults,
            mutators,
        );
        this.args = this.parent.args;
        this.key = JSON.stringify([this.parent.key, relation]);
        this.contract = definitions[name]!;
        this.one = this.contract.relations[relation]!.cardinality === 'one';
    }
    request(): ReturnType<Selection<S, D, N, ModelRow<D, N>, true>['request']> {
        return this.parent.request();
    }
    decode(
        raw: unknown,
    ): D[N]['relations'][R]['cardinality'] extends 'one'
        ? ModelInstance<S, D, RelatedName<D, N, R>> | undefined
        : readonly ModelInstance<S, D, RelatedName<D, N, R>>[] {
        const parent = this.parent.decode(raw);
        return ((parent?.data as Record<string, unknown> | undefined)?.[this.relation] ??
            (this.contract.relations[this.relation]?.cardinality === 'many' ? [] : undefined)) as never;
    }
}

export function hydrate<S extends Schema, D extends ContractMap>(
    schema: S,
    definitions: D,
    name: keyof D & string,
    queries: NativeQueries<S, D>,
    mutators: NativeMutators<S, D>,
    defaults: ClientDefaults,
    raw: unknown,
): unknown {
    if (raw === null || raw === undefined) return undefined;
    const contract: ModelContract = definitions[name]!;
    const source = raw as Record<string, unknown>;
    const data: Record<string, unknown> = Object.create(null);
    for (const [field, column] of Object.entries(contract.columns)) {
        if (!(field in source)) continue;
        const value = source[field];
        data[field] = decodeColumn(value, column, field);
    }
    for (const [relation, definition] of Object.entries(contract.relations)) {
        if (!(relation in source)) continue;
        const value = source[relation];
        const decode = (row: unknown) =>
            hydrate(schema, definitions, definition.model as keyof D & string, queries, mutators, defaults, row);
        data[relation] = Array.isArray(value) ? Object.freeze(value.map(decode)) : decode(value);
    }
    const instance = new ModelSnapshot(data);
    for (const operation of contract.mutations) {
        if (operation !== 'create')
            Object.defineProperty(instance, operation, {
                value: () => new Mutation(definitions, name, operation, mutators, defaults, data),
                enumerable: false,
            });
    }
    for (const relation of contract.includes) {
        if (!contract.queries.includes('one')) continue;
        Object.defineProperty(instance, relation, {
            get: () =>
                new RelationSelection(
                    schema,
                    definitions,
                    name,
                    queries,
                    data[contract.key] as string | number,
                    relation as IncludeName<D, keyof D & string>,
                    defaults,
                    mutators,
                ),
        });
    }
    return Object.freeze(instance);
}
