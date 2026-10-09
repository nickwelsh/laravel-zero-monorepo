import { Task, TaskList, definitions } from "./generated";
import type { CreateInput, Filter } from "@laravel-zero/client";
import {
  useData,
  useFilter,
  useMutation,
  useFilters,
  type FilterControls,
  type FilterControlProps,
} from "@laravel-zero/client/react";
import type { ComponentType } from "react";

// Compiled by typecheck; these are public-contract checks, not runtime tests.
function useContracts() {
  const data = useData(Task.query().all().with("list"));
  const date: Date | null | undefined = data.data[0]?.completed_at;
  const name: string | undefined = data.data[0]?.list?.name;
  const one = useData(Task.query().one("id").with("list"));
  const title: string | undefined = one.data?.title;
  const mutation = useMutation(Task.create());
  mutation({ title: "Hello", completed_at: new Date() });
  const BooleanControl: ComponentType<FilterControlProps<boolean>> = () => null;
  const SharedBooleanControl: ComponentType<
    FilterControlProps<boolean | null>
  > = () => null;
  const controls: FilterControls = { boolean: SharedBooleanControl };
  useFilter(Task, "done", { component: BooleanControl });
  Task.query()
    .all()
    .filters([
      { model: "Task", name: "done", value: false },
      { model: "Task", name: "title", value: "Hello" },
    ]);
  const [filters] = useFilters(Task, ["done", "title"]);
  Task.query().all().filters(filters);
  Task.query()
    .all()
    .filters([
      // @ts-expect-error filter names and values stay correlated in filter arrays
      { model: "Task", name: "done", value: "false" },
    ]);
  // @ts-expect-error wrong custom control value contract
  useFilter(Task, "title", { component: BooleanControl });
  // @ts-expect-error only declared filters are available
  useFilter(Task, "secret");
  // @ts-expect-error singular queries cannot paginate
  Task.query().one("id").infinite();
  // @ts-expect-error to-one includes cannot have a limit
  Task.query().all().with("list", 5);
  // @ts-expect-error junction includes cannot have a limit
  Task.query().all().with("tags", 5);
  Task.query().all().with("comments", 5);
  const nested = useData(
    Task.query()
      .all()
      .with("list", (list) => list.with("tasks", 2)),
  );
  const nestedDate: Date | null | undefined =
    nested.data[0]?.list?.tasks[0]?.created_at;
  Task.query()
    .all()
    .with("list", (list) => {
      // @ts-expect-error nested to-one includes cannot have limits either
      return list.limit(2);
    });
  Task.query()
    .all()
    .with("list", (list) => {
      // @ts-expect-error nested includes remain opt-in
      return list.with("user");
    });
  // @ts-expect-error queries are opt-in
  TaskList.query().all();
  // @ts-expect-error mutations are opt-in
  TaskList.create();
  // @ts-expect-error undeclared relations cannot be included
  Task.query().all().with("user");
  // @ts-expect-error server-filled ownership cannot be supplied
  Task.create().prepare({ title: "Hello", user_id: "alice" });
  // @ts-expect-error Date input cannot be supplied as a wire number
  Task.create().prepare({ title: "Hello", completed_at: 1700000000 });
  // @ts-expect-error create requires title
  Task.create().prepare({});
  // @ts-expect-error hidden columns are absent from public rows
  data.data[0]?.secret;
  // @ts-expect-error undeclared sorts are absent
  Task.query().all().orderBy("secret");
  // @ts-expect-error boolean filters do not accept string values
  Task.query().all().filter({ model: "Task", name: "done", value: "false" });
  return { date, name, title };
}
