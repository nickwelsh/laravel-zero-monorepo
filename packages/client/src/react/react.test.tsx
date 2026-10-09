// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Task } from "../../../../tests/interop/generated";
import { useData, useFilter, useFilters, useMutation } from "./index";

const native = vi.hoisted(() => ({
  raw: [] as unknown,
  details: { type: "unknown" } as { type: string; error?: unknown },
  connection: { name: "connected" },
  zero: { context: { user_id: "alice" }, mutate: vi.fn() },
  query: vi.fn(),
}));
vi.mock("@rocicorp/zero/react", () => ({
  useQuery: (request: unknown) => {
    native.query(request);
    return [native.raw, native.details];
  },
  useZero: () => native.zero,
  useConnectionState: () => native.connection,
  ZeroProvider: ({ children }: { children: unknown }) => children,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  native.raw = [];
  native.details = { type: "unknown" };
  native.query.mockClear();
  native.zero.mutate.mockReset();
});

describe("useData", () => {
  it("distinguishes incomplete empty, partial, and complete empty results", () => {
    const { result, rerender } = renderHook(() => useData(Task.query().all()));
    expect(result.current.status).toBe("loading");
    native.raw = [{ id: "a", title: "cached" }];
    rerender();
    expect(result.current.status).toBe("refreshing");
    native.raw = [];
    native.details = { type: "complete" };
    rerender();
    expect(result.current.status).toBe("success");
    expect(
      result.current.render({
        onIdle: () => 0,
        onLoading: () => 1,
        onRefreshing: () => 2,
        onFailure: () => 3,
        onStale: () => 4,
        onSuccess: () => 5,
      }),
    ).toBe(5);
  });

  it("reports failures, stale same-query data, and disabled queries", () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useData(Task.query().all(), { enabled }),
      { initialProps: { enabled: true } },
    );
    native.details = {
      type: "error",
      error: { type: "app", message: "Denied" },
    };
    rerender({ enabled: true });
    expect(result.current.status).toBe("failure");
    native.raw = [{ id: "a" }];
    rerender({ enabled: true });
    expect(result.current.status).toBe("stale");
    rerender({ enabled: false });
    expect(result.current.status).toBe("idle");
  });

  it("uses a lookahead row for hasMore and resets expanding limits when filters or identity change", () => {
    native.raw = [{ id: "a" }, { id: "b" }, { id: "c" }];
    native.details = { type: "complete" };
    const { result, rerender } = renderHook(
      ({ title }) =>
        useData(
          Task.query()
            .all()
            .filter({ model: "Task", name: "title", value: title })
            .infinite(2),
        ),
      { initialProps: { title: "first" } },
    );
    expect(result.current.data).toHaveLength(2);
    expect(result.current.infinite?.hasMore).toBe(true);
    expect(native.query.mock.lastCall?.[0].args.limit).toBe(3);
    act(() => result.current.infinite?.loadMore());
    expect(native.query.mock.lastCall?.[0].args.limit).toBe(5);
    rerender({ title: "second" });
    expect(native.query.mock.lastCall?.[0].args.limit).toBe(3);
    rerender({ title: "first" });
    expect(native.query.mock.lastCall?.[0].args.limit).toBe(3);
    rerender({ title: "second" });
    act(() => result.current.infinite?.loadMore());
    native.zero = { ...native.zero, context: { user_id: "bob" } };
    rerender({ title: "second" });
    expect(native.query.mock.lastCall?.[0].args.limit).toBe(3);
  });
});

describe("filter controls", () => {
  it("retains component identity and focus while debouncing query values", () => {
    vi.useFakeTimers();
    function useTitleFilter() {
      return useFilter(Task, "title", { debounceMs: 100 });
    }
    let current: ReturnType<typeof useTitleFilter>;
    function Host() {
      current = useTitleFilter();
      const [, Control] = current;
      return <Control />;
    }
    render(<Host />);
    const input = screen.getByRole("textbox");
    input.focus();
    const control = current![1];
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(current![1]).toBe(control);
    expect(current![0].value).toBeUndefined();
    act(() => vi.advanceTimersByTime(100));
    expect(current![0].value).toBe("Hello");
  });

  it("preserves false values and renders configured multiple controls", () => {
    function Host() {
      const [filters, Controls] = useFilters(Task, ["done", "title"]);
      return (
        <>
          <Controls />
          <output>
            {JSON.stringify(filters.map((filter) => filter.value))}
          </output>
        </>
      );
    }
    render(<Host />);
    fireEvent.change(screen.getByLabelText("done"), {
      target: { value: "false" },
    });
    expect(screen.getByRole("status").textContent).toBe("[false,null]");
  });
});

describe("useMutation", () => {
  it("exposes native client/server outcomes and structured field errors", async () => {
    native.zero.mutate.mockReturnValue({
      client: Promise.resolve({ type: "success" }),
      server: Promise.resolve({
        type: "error",
        error: {
          type: "app",
          message: "Validation failed",
          details: { fields: { title: ["Too short"] } },
        },
      }),
    });
    const { result } = renderHook(() => useMutation(Task.create()));
    let call: ReturnType<typeof result.current>;
    act(() => {
      call = result.current({ title: "x" });
    });
    await act(async () => {
      await call!.server;
    });
    expect(result.current.state.status).toBe("failure");
    expect(result.current.state.fields).toEqual({ title: ["Too short"] });
    expect(call!.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
