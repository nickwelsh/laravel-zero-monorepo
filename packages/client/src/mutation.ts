import {
  defineMutator,
  defineMutators,
  type Schema,
  type MutateRequest,
  type ReadonlyJSONValue,
  type Transaction,
  type Mutator,
  type MutatorDefinition,
  type AnyMutatorRegistry,
} from "@rocicorp/zero";
import { ulid } from "ulid";
import { v7 as uuidv7 } from "uuid";
import type {
  ClientContext,
  ContractMap,
  ModelContract,
  MutationInput,
  Operation,
} from "./contract";
import {
  columnValue,
  contextValue,
  fail,
  freeze,
  keys,
  object,
  validateRules,
} from "./validation";

export type MutationArgs = {
  id: string;
  data: { [key: string]: ReadonlyJSONValue };
  now: number;
};
export type ClientDefaults = {
  now?: () => Date;
  id?: (kind: "uuid" | "ulid", model: ModelContract) => string;
};
export type NativeMutators<
  S extends Schema,
  D extends ContractMap,
> = AnyMutatorRegistry & {
  [N in keyof D]: {
    [O in D[N]["mutations"][number]]: Mutator<MutationArgs, S, ClientContext>;
  };
};

export function createMutators<S extends Schema, D extends ContractMap>(
  defs: D,
): NativeMutators<S, D> {
  const definitions: Record<
    string,
    Record<string, MutatorDefinition<MutationArgs, MutationArgs, ClientContext>>
  > = Object.create(null);
  for (const [name, model] of Object.entries(defs)) {
    const operations: (typeof definitions)[string] = Object.create(null);
    for (const operation of model.mutations)
      operations[operation] = defineMutator(
        async ({
          tx,
          args,
          ctx,
        }: {
          tx: Transaction<S>;
          args: MutationArgs;
          ctx: ClientContext;
        }) => {
          validateMutation(model, operation, args);
          // Dynamic table access is kept here; caller inputs and generated models
          // retain concrete types. This uses Zero's own transaction and row store.
          const table = (
            tx.mutate as unknown as Record<
              string,
              {
                insert(row: Record<string, ReadonlyJSONValue>): Promise<void>;
                update(row: Record<string, ReadonlyJSONValue>): Promise<void>;
                delete(row: Record<string, ReadonlyJSONValue>): Promise<void>;
              }
            >
          )[model.table]!;
          const row: Record<string, ReadonlyJSONValue> = {
            [model.key]: args.id,
            ...args.data,
          };
          if (operation === "create") {
            for (const [field, column] of Object.entries(model.columns)) {
              if (field in row) continue;
              if (column.hasDefault) row[field] = column.default;
              else if (column.nullable) row[field] = null;
            }
            for (const [field, source] of Object.entries(model.serverFill))
              row[field] = columnValue(
                contextValue(ctx, source),
                model.columns[field]!,
                field,
              );
            if (model.timestamps.created)
              row[model.timestamps.created] = args.now;
            if (model.timestamps.updated)
              row[model.timestamps.updated] = args.now;
            if (model.timestamps.deleted) row[model.timestamps.deleted] = null;
            await table.insert(row);
          } else if (
            operation === "force_delete" ||
            (operation === "destroy" && !model.timestamps.deleted)
          )
            await table.delete({ [model.key]: args.id });
          else {
            if (model.timestamps.updated)
              row[model.timestamps.updated] = args.now;
            if (operation === "destroy")
              row[model.timestamps.deleted!] = args.now;
            if (operation === "restore") row[model.timestamps.deleted!] = null;
            await table.update(row);
          }
        },
      );
    definitions[name] = operations;
  }
  return defineMutators(definitions) as unknown as NativeMutators<S, D>;
}

function validateMutation(
  model: ModelContract,
  operation: Operation,
  args: MutationArgs,
): void {
  keys(object(args, "args"), ["id", "data", "now"], "args");
  if (typeof args.id !== "string" || args.id === "")
    fail("id", "Expected a record id.");
  if (!Number.isInteger(args.now) || Math.abs(args.now) > 8640000000000000)
    fail("now", "Invalid timestamp.");
  const data = object(args.data, "data");
  keys(
    data,
    operation === "create" || operation === "update" ? model.writable : [],
    "data",
  );
  for (const [field, value] of Object.entries(data))
    columnValue(value, model.columns[field]!, field);
  if (operation === "create")
    for (const field of model.writable) {
      const column = model.columns[field]!;
      if (!(field in data) && !column.nullable && !column.hasDefault)
        fail(field, "This field is required.");
    }
  validateRules(model, operation, { ...data, id: args.id });
}

export class Mutation<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
  O extends Operation,
> {
  constructor(
    readonly definitions: D,
    readonly name: N,
    readonly operation: O,
    readonly mutators: NativeMutators<S, D>,
    readonly defaults: ClientDefaults,
  ) {}
  get contract(): D[N] {
    return this.definitions[this.name]!;
  }
  get form() {
    return {
      columns: this.contract.columns,
      fields:
        this.operation === "create" || this.operation === "update"
          ? this.contract.writable
          : [],
    };
  }

  prepare(
    input: MutationInput<D, N, O>,
  ): MutateRequest<MutationArgs, S, ClientContext> {
    const value = object(input, "input");
    keys(
      value,
      [
        ...(this.operation === "create" || this.operation === "update"
          ? this.contract.writable
          : []),
        "id",
      ],
      "input",
    );
    const data: Record<string, ReadonlyJSONValue> = {};
    for (const [field, item] of Object.entries(value))
      if (field !== "id")
        data[field] = columnValue(
          item,
          this.contract.columns[field]!,
          field,
          true,
        );
    const id =
      value.id ??
      (this.operation === "create" && this.contract.idGenerator
        ? (
            this.defaults.id ??
            ((kind) => (kind === "uuid" ? uuidv7() : ulid()))
          )(this.contract.idGenerator, this.contract)
        : undefined);
    const args: MutationArgs = {
      id: id as string,
      data,
      now: (this.defaults.now ?? (() => new Date()))().getTime(),
    };
    validateMutation(this.contract, this.operation, args);
    const mutator = (
      this.mutators[this.name] as Partial<
        Record<Operation, Mutator<MutationArgs, S, ClientContext>>
      >
    )[this.operation];
    if (!mutator) fail("mutation", "Mutation is not enabled.");
    return mutator(freeze(args));
  }
}
