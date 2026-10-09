import type {
  ContractMap,
  ModelRow,
  IncludeArgs,
  IncludeName,
  RelatedName,
  RelationLimit,
} from "./contract";
import { fail, freeze } from "./validation";

export type IncludedRow<
  D extends ContractMap,
  N extends keyof D,
  R extends IncludeName<D, N>,
  Child,
> = D[N]["relations"][R]["cardinality"] extends "one"
  ? Child | undefined
  : readonly Child[];
type ChildBuilder<
  D extends ContractMap,
  N extends keyof D,
  R extends IncludeName<D, N>,
> = IncludeSelection<
  D,
  RelatedName<D, N, R>,
  ModelRow<D, RelatedName<D, N, R>>,
  RelationLimit<D, N, R>
>;

/** An immutable relationship refinement; the root selection validates the full tree. */
export class IncludeSelection<
  D extends ContractMap,
  N extends keyof D,
  Row = ModelRow<D, N>,
  Limit = never,
> {
  constructor(
    readonly definitions: D,
    readonly name: N,
    readonly args: IncludeArgs = {},
  ) {
    freeze(args);
  }

  with<R extends IncludeName<D, N>>(
    relation: R,
    limit?: RelationLimit<D, N, R>,
  ): IncludeSelection<
    D,
    N,
    Omit<Row, R> & {
      readonly [K in R]: IncludedRow<
        D,
        N,
        R,
        ModelRow<D, RelatedName<D, N, R>>
      >;
    },
    Limit
  >;
  with<R extends IncludeName<D, N>, Child>(
    relation: R,
    refine: (
      child: ChildBuilder<D, N, R>,
    ) => IncludeSelection<
      D,
      RelatedName<D, N, R>,
      Child,
      RelationLimit<D, N, R>
    >,
  ): IncludeSelection<
    D,
    N,
    Omit<Row, R> & { readonly [K in R]: IncludedRow<D, N, R, Child> },
    Limit
  >;
  with(
    relation: IncludeName<D, N>,
    refinement?: unknown,
  ): IncludeSelection<D, N, unknown, Limit> {
    return new IncludeSelection(this.definitions, this.name, {
      ...this.args,
      include: {
        ...this.args.include,
        [relation]: includeSpec(
          this.definitions,
          this.name,
          relation,
          refinement,
        ),
      },
    });
  }

  limit(limit: Limit): IncludeSelection<D, N, Row, Limit> {
    return new IncludeSelection(this.definitions, this.name, {
      ...this.args,
      limit: limit as number,
    });
  }
}

export function includeSpec<D extends ContractMap, N extends keyof D>(
  defs: D,
  name: N,
  relation: IncludeName<D, N>,
  refinement: unknown,
): IncludeArgs {
  const target = defs[name]!.relations[relation];
  if (!target || !defs[name]!.includes.includes(relation))
    fail("include", "Unknown include.");
  if (typeof refinement !== "function")
    return refinement === undefined ? {} : { limit: refinement as number };
  const result: unknown = refinement(new IncludeSelection(defs, target.model));
  if (
    !(result instanceof IncludeSelection) ||
    result.definitions !== defs ||
    result.name !== target.model
  )
    fail("include", "Return a refinement of the supplied relationship.");
  return result.args;
}
