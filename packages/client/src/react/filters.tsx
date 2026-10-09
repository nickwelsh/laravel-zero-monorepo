import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Schema } from "@rocicorp/zero";
import type {
  ContractMap,
  Filter,
  FilterName,
  FilterValue,
  ModelContract,
} from "../contract";
import type { Model } from "../runtime";
import { fail } from "../validation";

export interface FilterControlProps<T> {
  value: T | undefined;
  onChange(value: T | undefined): void;
  name: string;
  label: string;
  disabled?: boolean;
}
export interface ControlProps {
  label?: string;
  disabled?: boolean;
}
export interface FilterOptions<T> {
  initialValue?: T;
  debounceMs?: number;
  component?: ComponentType<FilterControlProps<T>>;
}
type AnyControl = ComponentType<FilterControlProps<unknown>>;
export type FilterControls = Partial<
  Record<
    "string" | "number" | "boolean" | "date" | "json" | "belongsTo" | "trashed",
    AnyControl
  >
>;
const Config = createContext<FilterControls>({});
export function FilterProvider({
  controls,
  children,
}: {
  controls: FilterControls;
  children: ReactNode;
}) {
  return <Config.Provider value={controls}>{children}</Config.Provider>;
}

type Snapshot = { input: unknown; query: unknown };
function binding(
  model: ModelContract,
  name: string,
  options: FilterOptions<unknown>,
) {
  const filter = model.filters[name];
  if (!filter) fail("filter", `Unknown filter ${name}.`);
  const column = model.columns[filter.field];
  const kind =
    filter.kind === "belongsTo" || filter.kind === "trashed"
      ? filter.kind
      : column?.date
        ? "date"
        : (column?.type ?? "string");
  let snapshot: Snapshot = {
    input: options.initialValue,
    query: options.initialValue,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const change = (value: unknown) => {
    clearTimeout(timer);
    snapshot = { input: value, query: snapshot.query };
    if ((options.debounceMs ?? 0) > 0)
      timer = setTimeout(() => {
        snapshot = { input: value, query: value };
        emit();
      }, options.debounceMs);
    else snapshot = { input: value, query: value };
    emit();
  };
  const store = {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => snapshot,
    dispose: () => clearTimeout(timer),
    change,
  };
  const Control = ({ label = name, disabled }: ControlProps) => {
    const registry = useContext(Config);
    const value = useSyncExternalStore(
      store.subscribe,
      store.get,
      store.get,
    ).input;
    const Component = options.component ?? registry[kind] ?? DefaultControl;
    return createElement(Component, {
      value,
      onChange: change,
      name,
      label,
      ...(disabled === undefined ? {} : { disabled }),
      ...{ kind, column },
    });
  };
  return { ...store, Control };
}

function DefaultControl({
  value,
  onChange,
  name,
  label,
  disabled,
  kind,
  column,
}: FilterControlProps<unknown> & {
  kind?: string;
  column?: ModelContract["columns"][string];
}) {
  if (kind === "boolean" || kind === "trashed" || column?.enum) {
    const values =
      kind === "boolean"
        ? [true, false]
        : kind === "trashed"
          ? ["without", "with", "only"]
          : column!.enum!;
    return (
      <label>
        {label}
        <select
          aria-label={label}
          name={name}
          disabled={disabled}
          value={value === undefined ? "" : String(value)}
          onChange={(event) =>
            onChange(
              event.target.value === ""
                ? undefined
                : values.find((item) => String(item) === event.target.value),
            )
          }
        >
          <option value="">Any</option>
          {values.map((item) => (
            <option key={String(item)} value={String(item)}>
              {String(item)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (kind === "json")
    return (
      <label>
        {label}
        <textarea
          aria-label={label}
          name={name}
          disabled={disabled}
          value={value === undefined ? "" : JSON.stringify(value)}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value));
            } catch {
              /* Invalid JSON is not a query value. */
            }
          }}
        />
      </label>
    );
  const text =
    value instanceof Date
      ? value.toISOString().slice(0, 16)
      : value === undefined || value === null
        ? ""
        : String(value);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        name={name}
        disabled={disabled}
        type={
          kind === "date"
            ? "datetime-local"
            : kind === "number"
              ? "number"
              : "text"
        }
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(
            kind === "date"
              ? raw
                ? new Date(`${raw}Z`)
                : undefined
              : kind === "number"
                ? raw === ""
                  ? undefined
                  : Number(raw)
                : raw,
          );
        }}
      />
    </label>
  );
}

function useBindings<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
>(
  model: Model<S, D, N>,
  names: readonly string[],
  options: FilterOptions<unknown>,
) {
  const key = names.join("\0");
  const group = useMemo(() => {
    const stores = names.map((name) => binding(model.contract, name, options));
    let snapshot = stores.map((store) => store.get());
    const get = () => {
      const next = stores.map((store) => store.get());
      if (next.some((value, i) => value !== snapshot[i])) snapshot = next;
      return snapshot;
    };
    return {
      stores,
      get,
      subscribe: (listener: () => void) => {
        const cleanup = stores.map((store) => store.subscribe(listener));
        return () => cleanup.forEach((fn) => fn());
      },
      Controls: () => (
        <>
          {stores.map((store, i) => (
            <store.Control key={names[i]} />
          ))}
        </>
      ),
    };
  }, [model, key]);
  useEffect(
    () => () => group.stores.forEach((store) => store.dispose()),
    [group],
  );
  const snapshot = useSyncExternalStore(group.subscribe, group.get, group.get);
  return { group, snapshot };
}

export function useFilter<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
  F extends FilterName<D, N>,
>(
  model: Model<S, D, N>,
  name: F,
  options: FilterOptions<FilterValue<D, N, F>> = {},
): readonly [
  Filter<D, N, F>,
  ComponentType<ControlProps>,
  (value: FilterValue<D, N, F> | undefined) => void,
] {
  const { group, snapshot } = useBindings(
    model,
    [name],
    options as FilterOptions<unknown>,
  );
  return [
    {
      model: model.name,
      name,
      value: snapshot[0]!.query as FilterValue<D, N, F> | undefined,
    },
    group.stores[0]!.Control,
    group.stores[0]!.change,
  ];
}

export function useFilters<
  S extends Schema,
  D extends ContractMap,
  N extends keyof D & string,
  const Names extends readonly FilterName<D, N>[],
>(
  model: Model<S, D, N>,
  names: Names,
  options: Omit<FilterOptions<unknown>, "component"> = {},
): readonly [readonly Filter<D, N>[], ComponentType] {
  const { group, snapshot } = useBindings(model, names, options);
  return [
    names.map((name, i) => ({
      model: model.name,
      name,
      value: snapshot[i]!.query as FilterValue<D, N, typeof name> | undefined,
    })),
    group.Controls,
  ];
}
