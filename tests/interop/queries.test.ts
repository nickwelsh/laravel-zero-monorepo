import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { handleQueryRequest } from "@rocicorp/zero/server";
import { schema, queries, definitions } from "./generated";
import type { QueryArgs } from "@laravel-zero/client";

describe("PHP / native Zero query equivalence", () => {
  for (const [name, args] of [
    ["Task.all", {}],
    [
      "Task.all",
      {
        filters: { done: false, title: "a%_\\b", completed_at: null },
        include: { list: {} },
      },
    ],
    [
      "Task.all",
      { filters: { list: "list-a" }, order: [["title", "asc"]], limit: 23 },
    ],
    ["Task.all", { filters: { trashed: "only" } }],
    ["Task.one", { id: "a", include: { list: {} } }],
  ] as const) {
    it(`${name} ${JSON.stringify(args)}`, async () => {
      const body = ["transform", [{ id: "q", name, args: [args] }]];
      const native = await handleQueryRequest({
        schema,
        body,
        query: {},
        userID: "alice",
        handler: (name, args) => {
          const [model, operation] = name.split(".");
          return queries.Task[operation as "all" | "one"].fn({
            args: args as QueryArgs,
            ctx: { user_id: "alice" },
          });
        },
      });
      const php = JSON.parse(
        execFileSync(
          "rtk",
          ["php", "tests/interop/export.php", name, JSON.stringify(args)],
          { encoding: "utf8" },
        ),
      );
      expect("kind" in native && native.kind).toBe("QueryResponse");
      if ("kind" in native && native.kind === "QueryResponse")
        expect(native.queries[0]).toEqual({ id: "q", name, ast: php });
    });
  }
});
