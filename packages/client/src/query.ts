import {
  createBuilder,
  defineQuery,
  defineQueries,
  type Schema,
  type Query,
  type QueryRequest,
  type ReadonlyJSONValue,
  type CustomQuery,
  type QueryDefinition,
} from "@rocicorp/zero";
import type {
  ClientContext,
  ContractMap,
  ModelContract,
  QueryArgs,
  IncludeArgs,
  ModelRow,
  Filter,
  FilterName,
  FilterValue,
  IncludeName,
  RelatedRow,
  RelationLimit,
} from "./contract";
import {
  columnValue,
  contextValue,
  fail,
  freeze,
  validateQueryArgs,
} from "./validation";

type Table<S extends Schema> = keyof S["tables"] & string;
type RawRow = Record<string, unknown>;
type WireRow<T> = T extends Date
  ? number
  : T extends readonly (infer V)[]
    ? readonly WireRow<V>[]
    : T extends object
      ? { readonly [K in keyof T]: WireRow<T[K]> }
      : T;
type NativeQuery<S extends Schema> = Query<Table<S>, S, RawRow | undefined>;
export type NativeQueries<S extends Schema, D extends ContractMap> = {
  [N in keyof D]: {
    [O in D[N]["queries"][number]]: CustomQuery<
      Table<S>,
      QueryArgs,
      QueryArgs,
      S,
      RawRow | undefined,
      ClientContext
    >;
  };
};

// Schema and method names are dynamic at this one internal seam. The generated
// model surface retains concrete names and result types; Zero validates the schema.
type DynamicQuery = Query<string, Schema, RawRow | undefined>;
type DynamicBuilder = Record<string, DynamicQuery>;

export function createQueries<S extends Schema, D extends ContractMap>(
  schema: S,
  defs: D,
): NativeQueries<S, D> {
  const builder = createBuilder(schema) as unknown as DynamicBuilder;
  const definitions: Record<
    string,
    Record<
      string,
      QueryDefinition<
        string,
        QueryArgs,
        QueryArgs,
        RawRow | undefined,
        ClientContext
      >
    >
  > = Object.create(null);
  for (const [name, model] of Object.entries(defs)) {
    const operations: (typeof definitions)[string] = Object.create(null);
    for (const operation of model.queries)
      operations[operation] = defineQuery(
        ({ args, ctx }: { args: QueryArgs; ctx: ClientContext }) => {
          validateQueryArgs(defs, model, operation, args);
          let query = buildQuery(builder[model.table]!, defs, model, args, ctx);
          if (operation === "one")
            query = query.where(model.key as never, args.id as never).one();
          else query = query.limit(args.limit ?? model.defaultLimit);
          return query;
        },
      );
    definitions[name] = operations;
  }
  return defineQueries(definitions) as unknown as NativeQueries<S, D>;
}

function buildQuery(
  query: DynamicQuery,
  defs: ContractMap,
  model: ModelContract,
  args: QueryArgs | IncludeArgs,
  ctx: ClientContext,
  junction = false,
): DynamicQuery {
  for (const rule of model.authorization) {
    const value =
      "context" in rule.value
        ? contextValue(ctx, rule.value.context)
        : rule.value.literal;
    query = query.where(rule.field as never, rule.op as never, value as never);
  }
  const filters = "filters" in args ? (args.filters ?? {}) : {};
  const trashed = filters.trashed ?? "without";
  if (model.timestamps.deleted && trashed !== "with")
    query = query.where(
      model.timestamps.deleted as never,
      trashed === "only" ? "IS NOT" : "IS",
      null as never,
    );
  for (const [name, value] of Object.entries(filters)) {
    const filter = model.filters[name]!;
    if (filter.kind === "trashed") continue;
    if (filter.kind === "belongsTo") {
      const target = defs[model.relations[filter.field]!.model]!;
      query = query.whereExists(filter.field, (related) =>
        buildQuery(related as DynamicQuery, defs, target, {}, ctx).where(
          target.key as never,
          value as never,
        ),
      );
    } else {
      const operand =
        filter.kind === "partial"
          ? `%${(value as string).replace(/[\\%_]/g, "\\$&")}%`
          : value;
      query = query.where(
        filter.field as never,
        filter.kind === "partial" ? "ILIKE" : value === null ? "IS" : "=",
        operand as never,
      );
    }
  }
  if (!junction) {
    const order = args.order ?? model.defaultOrder;
    for (const [field, direction] of order)
      query = query.orderBy(field, direction);
    if (!order.some(([field]) => field === model.key))
      query = query.orderBy(model.key, "asc");
  }
  if (args.limit !== undefined) query = query.limit(args.limit);
  for (const [name, spec] of Object.entries(args.include ?? {})) {
    const relation = model.relations[name]!;
    query = query.related(name, (related) =>
      buildQuery(
        related as DynamicQuery,
        defs,
        defs[relation.model]!,
        spec,
        ctx,
        relation.path.length > 1,
      ),
    );
  }
  return query;
}

export type SelectionData<Q> =
  Q extends Selection<Schema, ContractMap, string, infer Row, infer One>
    ? One extends true
      ? Row | undefined
      : readonly Row[]
    : never;

export class Selection<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
  Row = ModelRow<D, N>,
  One extends boolean = false,
> {
  constructor(
    readonly schema: S,
    readonly definitions: D,
    readonly name: N,
    readonly queries: NativeQueries<S, D>,
    readonly one: One,
    readonly args: Readonly<QueryArgs> = {},
    readonly pageSize: number | undefined = undefined,
  ) {
    freeze(this.args);
  }

  get contract(): D[N] {
    return this.definitions[this.name]!;
  }
  get key(): string {
    return JSON.stringify([this.name, this.one, this.args, this.pageSize]);
  }

  private copy<NextRow = Row>(
    args: QueryArgs,
    pageSize = this.pageSize,
  ): Selection<S, D, N, NextRow, One> {
    validateQueryArgs(
      this.definitions,
      this.contract,
      this.one ? "one" : "all",
      args,
    );
    return new Selection(
      this.schema,
      this.definitions,
      this.name,
      this.queries,
      this.one,
      args,
      pageSize,
    );
  }

  filter<F extends FilterName<D, N>>(
    this: Selection<S, D, N, Row, false>,
    filter: Filter<D, N, F>,
  ): Selection<S, D, N, Row, false> {
    if (filter.model !== this.name)
      fail("filter", "Filter belongs to another model.");
    const definition = this.contract.filters[filter.name];
    if (!definition) fail("filter", "Unknown filter.");
    const filters = { ...this.args.filters };
    if (filter.value === undefined) delete filters[filter.name];
    else {
      const column = this.contract.columns[definition.field];
      filters[filter.name] = column
        ? columnValue(filter.value, column, filter.name, true)
        : (filter.value as ReadonlyJSONValue);
    }
    return this.copy({ ...this.args, filters });
  }

  filters(
    this: Selection<S, D, N, Row, false>,
    filters: readonly Filter<D, N>[],
  ): Selection<S, D, N, Row, false> {
    return filters.reduce(
      (query, filter) => query.filter(filter),
      this as Selection<S, D, N, Row, false>,
    );
  }

  with<R extends IncludeName<D, N>>(
    relation: R,
    limit?: RelationLimit<D, N, R>,
  ): Selection<S, D, N, Row & { readonly [K in R]: RelatedRow<D, N, R> }, One> {
    const spec: IncludeArgs = limit === undefined ? {} : { limit };
    return this.copy({
      ...this.args,
      include: { ...this.args.include, [relation]: spec },
    });
  }

  orderBy(
    this: Selection<S, D, N, Row, false>,
    field: D[N]["sorts"][number],
    direction: "asc" | "desc" = "asc",
  ): Selection<S, D, N, Row, false> {
    return this.copy({
      ...this.args,
      order: [
        ...(this.args.order ?? []).filter(([key]) => key !== field),
        [field, direction],
      ],
    });
  }

  limit(
    this: Selection<S, D, N, Row, false>,
    limit: number,
  ): Selection<S, D, N, Row, false> {
    return this.copy({ ...this.args, limit });
  }
  withTrashed(
    this: Selection<S, D, N, Row, false> &
      ("trashed" extends FilterName<D, N> ? unknown : never),
  ): Selection<S, D, N, Row, false> {
    return this.copy({
      ...this.args,
      filters: { ...this.args.filters, trashed: "with" },
    });
  }
  onlyTrashed(
    this: Selection<S, D, N, Row, false> &
      ("trashed" extends FilterName<D, N> ? unknown : never),
  ): Selection<S, D, N, Row, false> {
    return this.copy({
      ...this.args,
      filters: { ...this.args.filters, trashed: "only" },
    });
  }
  infinite(
    this: Selection<S, D, N, Row, false>,
    pageSize = this.contract.defaultLimit,
  ): Selection<S, D, N, Row, false> {
    return this.copy({ ...this.args, limit: pageSize }, pageSize);
  }

  request(): QueryRequest<
    Table<S>,
    QueryArgs,
    QueryArgs,
    S,
    One extends true ? WireRow<Row> | undefined : WireRow<Row>,
    ClientContext
  > {
    const operation = this.one ? "one" : "all";
    const query = (
      this.queries[this.name] as Partial<
        Record<
          "all" | "one",
          CustomQuery<
            Table<S>,
            QueryArgs,
            QueryArgs,
            S,
            RawRow | undefined,
            ClientContext
          >
        >
      >
    )[operation];
    if (!query) fail("query", "Query is not enabled.");
    return query(this.args) as unknown as QueryRequest<
      Table<S>,
      QueryArgs,
      QueryArgs,
      S,
      One extends true ? WireRow<Row> | undefined : WireRow<Row>,
      ClientContext
    >;
  }

  decode(raw: unknown): One extends true ? Row | undefined : readonly Row[] {
    const decodeRow = (row: unknown, model: ModelContract): unknown => {
      if (row === undefined || row === null) return undefined;
      const decoded = { ...(row as Record<string, unknown>) };
      for (const [name, column] of Object.entries(model.columns))
        if (column.date && typeof decoded[name] === "number")
          decoded[name] = new Date(decoded[name] as number);
      for (const [name, relation] of Object.entries(model.relations))
        if (name in decoded) {
          const target = this.definitions[relation.model]!;
          decoded[name] = Array.isArray(decoded[name])
            ? (decoded[name] as unknown[]).map((row) => decodeRow(row, target))
            : decodeRow(decoded[name], target);
        }
      return decoded;
    };
    return (
      this.one
        ? decodeRow(raw, this.contract)
        : Array.isArray(raw)
          ? raw.map((row) => decodeRow(row, this.contract))
          : []
    ) as One extends true ? Row | undefined : readonly Row[];
  }
}
