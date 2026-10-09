import type { ReadonlyJSONValue } from "@rocicorp/zero";

export interface Column {
  readonly type: "string" | "number" | "boolean" | "json";
  readonly nullable: boolean;
  readonly date: boolean;
  readonly enum: readonly (string | number)[] | null;
  readonly hasDefault: boolean;
  readonly default: ReadonlyJSONValue;
}

export interface Relation {
  readonly model: string;
  readonly cardinality: "one" | "many";
  readonly path: readonly {
    readonly source: readonly string[];
    readonly dest: readonly string[];
    readonly table: string;
  }[];
}

export type Operation =
  "create" | "update" | "destroy" | "restore" | "force_delete";
export type ClientContext = Readonly<
  Record<string, string | number | boolean | null>
> & { readonly user_id: string | number | null };

export interface ModelContract {
  readonly name: string;
  readonly table: string;
  readonly key: string;
  readonly columns: Readonly<Record<string, Column>>;
  readonly queries: readonly ("all" | "one")[];
  readonly mutations: readonly Operation[];
  readonly validation: Partial<
    Readonly<Record<Operation, Readonly<Record<string, readonly string[]>>>>
  >;
  readonly authorization: readonly {
    readonly field: string;
    readonly op: string;
    readonly value:
      | { readonly context: string }
      | { readonly literal: string | number | boolean | null };
  }[];
  readonly serverFill: Readonly<Record<string, string>>;
  readonly writable: readonly string[];
  readonly idGenerator: "uuid" | "ulid" | null;
  readonly timestamps: {
    readonly created: string | null;
    readonly updated: string | null;
    readonly deleted: string | null;
  };
  readonly filters: Readonly<
    Record<
      string,
      {
        readonly kind: "exact" | "partial" | "belongsTo" | "trashed";
        readonly field: string;
      }
    >
  >;
  readonly includes: readonly string[];
  readonly sorts: readonly string[];
  readonly defaultOrder: readonly (readonly [string, "asc" | "desc"])[];
  readonly defaultLimit: number;
  readonly maxLimit: number;
  readonly relations: Readonly<Record<string, Relation>>;
}

export type ContractMap = Readonly<Record<string, ModelContract>>;
type BaseValue<C extends Column> = C["date"] extends true
  ? Date
  : C["enum"] extends readonly (string | number)[]
    ? C["enum"][number]
    : C["type"] extends "string"
      ? string
      : C["type"] extends "number"
        ? number
        : C["type"] extends "boolean"
          ? boolean
          : ReadonlyJSONValue;
export type ColumnValue<C extends Column> =
  BaseValue<C> | (C["nullable"] extends true ? null : never);
export type ModelRow<D extends ContractMap, N extends keyof D> = {
  readonly [F in keyof D[N]["columns"]]: ColumnValue<D[N]["columns"][F]>;
};
export type RecordId<D extends ContractMap, N extends keyof D> = ColumnValue<
  D[N]["columns"][D[N]["key"] & keyof D[N]["columns"]]
> &
  (string | number);
export type FilterName<
  D extends ContractMap,
  N extends keyof D,
> = keyof D[N]["filters"] & string;
export type FilterValue<
  D extends ContractMap,
  N extends keyof D,
  F extends FilterName<D, N>,
> =
  F extends FilterName<D, N>
    ? D[N]["filters"][F]["kind"] extends "trashed"
      ? "without" | "with" | "only"
      : D[N]["filters"][F]["kind"] extends "partial"
        ? string
        : D[N]["filters"][F]["kind"] extends "belongsTo"
          ? RecordId<
              D,
              RelatedName<
                D,
                N,
                D[N]["filters"][F]["field"] & keyof D[N]["relations"] & string
              >
            >
          : D[N]["filters"][F]["field"] extends keyof D[N]["columns"]
            ? ColumnValue<D[N]["columns"][D[N]["filters"][F]["field"]]>
            : never
    : never;
export type Filter<
  D extends ContractMap,
  N extends keyof D,
  F extends FilterName<D, N> = FilterName<D, N>,
> =
  F extends FilterName<D, N>
    ? {
        readonly model: N;
        readonly name: F;
        readonly value: FilterValue<D, N, F> | undefined;
      }
    : never;
type Writable<
  D extends ContractMap,
  N extends keyof D,
> = D[N]["writable"][number] & keyof D[N]["columns"];
type Rules<
  D extends ContractMap,
  N extends keyof D,
  O extends Operation,
  F extends PropertyKey,
> = O extends keyof D[N]["validation"]
  ? F extends keyof D[N]["validation"][O]
    ? D[N]["validation"][O][F]
    : readonly []
  : readonly [];
type RequiredFields<
  D extends ContractMap,
  N extends keyof D,
  O extends Operation,
> = {
  [F in Writable<D, N>]: Rules<D, N, O, F> extends readonly string[]
    ? "required" extends Rules<D, N, O, F>[number]
      ? "sometimes" extends Rules<D, N, O, F>[number]
        ? never
        : F
      : never
    : never;
}[Writable<D, N>];
type OptionalCreate<D extends ContractMap, N extends keyof D> = {
  [F in Writable<D, N>]: F extends RequiredFields<D, N, "create">
    ? never
    : D[N]["columns"][F]["nullable"] extends true
      ? F
      : D[N]["columns"][F]["hasDefault"] extends true
        ? F
        : never;
}[Writable<D, N>];
export type CreateInput<D extends ContractMap, N extends keyof D> = {
  [F in Exclude<Writable<D, N>, OptionalCreate<D, N>>]: ColumnValue<
    D[N]["columns"][F]
  >;
} & { [F in OptionalCreate<D, N>]?: ColumnValue<D[N]["columns"][F]> } & {
  id?: string;
};
export type UpdateInput<D extends ContractMap, N extends keyof D> = {
  id: RecordId<D, N>;
} & {
  [F in RequiredFields<D, N, "update">]: ColumnValue<D[N]["columns"][F]>;
} & {
  [F in Exclude<Writable<D, N>, RequiredFields<D, N, "update">>]?: ColumnValue<
    D[N]["columns"][F]
  >;
};
export type MutationInput<
  D extends ContractMap,
  N extends keyof D,
  O extends Operation,
> = O extends "create"
  ? CreateInput<D, N>
  : O extends "update"
    ? UpdateInput<D, N>
    : { id: RecordId<D, N> };
export type IncludeName<
  D extends ContractMap,
  N extends keyof D,
> = D[N]["includes"][number] & keyof D[N]["relations"] & string;
export type RelatedName<
  D extends ContractMap,
  N extends keyof D,
  R extends keyof D[N]["relations"] & string,
> = D[N]["relations"][R]["model"] & keyof D;
export type RelatedRow<
  D extends ContractMap,
  N extends keyof D,
  R extends IncludeName<D, N>,
> = D[N]["relations"][R]["cardinality"] extends "one"
  ? ModelRow<D, RelatedName<D, N, R>> | undefined
  : readonly ModelRow<D, RelatedName<D, N, R>>[];
export type RelationLimit<
  D extends ContractMap,
  N extends keyof D,
  R extends IncludeName<D, N>,
> = D[N]["relations"][R]["cardinality"] extends "many"
  ? D[N]["relations"][R]["path"]["length"] extends 1
    ? number
    : never
  : never;

export type QueryArgs = {
  id?: string | number;
  filters?: { [key: string]: ReadonlyJSONValue };
  include?: { [key: string]: IncludeArgs };
  order?: [string, "asc" | "desc"][];
  limit?: number;
};
export type IncludeArgs = {
  include?: { [key: string]: IncludeArgs };
  order?: [string, "asc" | "desc"][];
  limit?: number;
};
