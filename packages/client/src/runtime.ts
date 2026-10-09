import type { Schema } from "@rocicorp/zero";
import type { ContractMap, ModelRow, RecordId } from "./contract";
import { Selection, createQueries } from "./query";
import { Mutation, createMutators, type ClientDefaults } from "./mutation";

export type Model<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
> = {
  readonly name: N;
  readonly definitions: D;
  readonly contract: D[N];
  query(): {
    [O in D[N]["queries"][number]]: O extends "all"
      ? () => Selection<S, D, N, ModelRow<D, N>, false>
      : (id: RecordId<D, N>) => Selection<S, D, N, ModelRow<D, N>, true>;
  };
} & { [O in D[N]["mutations"][number]]: () => Mutation<S, D, N, O> };

export function createLaravelZero<
  S extends Schema,
  const D extends ContractMap,
>(schema: S, definitions: D, defaults: ClientDefaults = {}) {
  const queries = createQueries(schema, definitions);
  const mutators = createMutators<S, D>(definitions);
  const models: Record<string, unknown> = Object.create(null);
  for (const [name, contract] of Object.entries(definitions)) {
    const methods: Record<string, unknown> = Object.create(null);
    for (const operation of contract.mutations)
      methods[operation] = () =>
        new Mutation(definitions, name, operation, mutators, defaults);
    models[name] = {
      name,
      definitions,
      contract,
      ...methods,
      query: () => {
        const operations: Record<string, unknown> = Object.create(null);
        for (const operation of contract.queries)
          operations[operation] =
            operation === "all"
              ? () => new Selection(schema, definitions, name, queries, false)
              : (id: string | number) =>
                  new Selection(schema, definitions, name, queries, true, {
                    id,
                  });
        return operations;
      },
    };
  }
  return {
    schema,
    definitions,
    queries,
    mutators,
    models: models as { [N in keyof D & string]: Model<S, D, N> },
  };
}
