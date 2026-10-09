import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  Task,
  definitions,
  schema,
  queries,
} from "../../../tests/interop/generated";
import { createLaravelZero } from "./index";

describe("generated models", () => {
  it("accepts numeric record IDs for reads and updates on existing integer-key tables", () => {
    const runtime = createLaravelZero(schema, {
      ...definitions,
      Task: {
        ...definitions.Task,
        mutations: ["update"],
        idGenerator: null,
        columns: {
          ...definitions.Task.columns,
          id: { ...definitions.Task.columns.id, type: "number" },
        },
      },
    } as const);
    expect(runtime.models.Task.query().one(42).args.id).toBe(42);
    expect(
      runtime.models.Task.update().prepare({ id: 42, title: "Updated" }).args
        .id,
    ).toBe(42);
    expect(() =>
      runtime.models.Task.update().prepare({
        id: "42",
        title: "Updated",
      } as never),
    ).toThrow(/value/i);
  });
  it("rejects null substring filters even when the column is nullable", () => {
    const runtime = createLaravelZero(schema, {
      ...definitions,
      Task: {
        ...definitions.Task,
        columns: {
          ...definitions.Task.columns,
          title: { ...definitions.Task.columns.title, nullable: true },
        },
      },
    } as const);
    expect(() =>
      runtime.models.Task.query()
        .all()
        .filter({ model: "Task", name: "title", value: null } as never),
    ).toThrow(/string/i);
  });
  it("tracks nested include shapes and refinements", () => {
    const selection = Task.query()
      .all()
      .with("list", (list) => list.with("tasks", 2));
    expect(selection.args.include).toEqual({
      list: { include: { tasks: { limit: 2 } } },
    });
    const rows = selection.decode([
      {
        id: "a",
        list: { id: "l", tasks: [{ id: "b", created_at: 1700000000000 }] },
      },
    ]);
    expect(rows[0]?.list?.tasks[0]?.created_at).toEqual(
      new Date(1700000000000),
    );
  });
  it("validates portable FormRequest rules before enqueueing", () => {
    const runtime = createLaravelZero(schema, {
      ...definitions,
      Task: {
        ...definitions.Task,
        validation: {
          create: {
            title: ["required", "max:3"],
            done: ["required", "boolean"],
          },
        },
      },
    } as const);
    expect(() =>
      runtime.models.Task.create().prepare({ title: "long", done: false }),
    ).toThrow(/max:3/);
    expect(() =>
      runtime.models.Task.create().prepare({ title: "ok" } as never),
    ).toThrow(/required/);
    expect(
      runtime.models.Task.create().prepare({ title: "ok", done: false }).args
        .data.done,
    ).toBe(false);
  });
  it("builds immutable query arguments and uses native named queries", () => {
    const base = Task.query().all();
    const refined = base
      .filter({ model: "Task", name: "done", value: false })
      .with("list")
      .orderBy("title")
      .limit(20);
    expect(base.args).toEqual({});
    expect(refined.args).toEqual({
      filters: { done: false },
      include: { list: {} },
      order: [["title", "asc"]],
      limit: 20,
    });
    expect(refined.request().query.queryName).toBe("Task.all");
  });

  it("keeps null, false, empty strings, and unset distinct", () => {
    const selection = Task.query()
      .all()
      .filter({ model: "Task", name: "done", value: false })
      .filter({ model: "Task", name: "title", value: "" })
      .filter({ model: "Task", name: "completed_at", value: null });
    expect(selection.args.filters).toEqual({
      done: false,
      title: "",
      completed_at: null,
    });
    expect(
      selection.filter({ model: "Task", name: "title", value: undefined }).args
        .filters,
    ).toEqual({ done: false, completed_at: null });
  });

  it("decodes dates in roots and included rows without changing native rows", () => {
    const row = {
      id: "a",
      title: "Hello",
      created_at: 1700000000000,
      completed_at: null,
      list: { id: "l", name: "List" },
    };
    const decoded = Task.query().all().with("list").decode([row]);
    expect(decoded[0]?.created_at).toEqual(new Date(1700000000000));
    expect(decoded[0]?.completed_at).toBeNull();
    expect(row.created_at).toBe(1700000000000);
  });

  it("prepares IDs and timestamps once before enqueueing and hides protected fields", () => {
    let ticks = 0;
    const runtime = createLaravelZero(schema, definitions, {
      now: () => new Date(++ticks),
      id: () => "019a0000-0000-7000-8000-000000000001",
    });
    const operation = runtime.models.Task.create();
    const request = operation.prepare({
      title: "Hello",
      completed_at: new Date(1700000000123),
    });
    expect(request.args).toEqual({
      id: "019a0000-0000-7000-8000-000000000001",
      data: { title: "Hello", completed_at: 1700000000123 },
      now: 1,
    });
    expect(ticks).toBe(1);
    expect(() =>
      operation.prepare({ title: "Hello", user_id: "bob" } as never),
    ).toThrow(/protected|Unknown/);
    expect(() => operation.prepare({} as never)).toThrow(/required/);
  });

  it("rejects runtime calls that bypass generated TypeScript restrictions", () => {
    expect(() =>
      Task.query()
        .all()
        .with("list", 2 as never),
    ).toThrow(/limit/i);
    expect(() =>
      Task.query()
        .all()
        .orderBy("secret" as never),
    ).toThrow(/sort/i);
    expect(() => Task.query().all().limit(1001)).toThrow(/limit/i);
    expect(() =>
      Task.query()
        .all()
        .filter({ model: "Other", name: "title", value: "x" } as never),
    ).toThrow(/model/i);
  });
});
