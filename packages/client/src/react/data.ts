import { useQuery, useZero, useConnectionState, type UseQueryOptions } from '@rocicorp/zero/react';
import type { Schema, QueryResultDetails, ConnectionState } from '@rocicorp/zero';
import { useMemo, useState } from 'react';
import type { ClientContext, ContractMap } from '../contract';
import type { Selection } from '../query';

export type DataStatus = 'idle' | 'loading' | 'refreshing' | 'failure' | 'stale' | 'success';
export type RenderHandlers<T, R> = {
    onIdle: () => R;
    onLoading: () => R;
    onRefreshing: (data: T) => R;
    onFailure: (error: Error) => R;
    onStale: (value: readonly [T, Error]) => R;
    onSuccess: (data: T) => R;
};
export interface InfiniteData {
    readonly hasMore: boolean | undefined;
    readonly limit: number;
    readonly capped: boolean;
    loadMore(): void;
}
export interface Data<T> {
    readonly data: T;
    readonly status: DataStatus;
    readonly complete: boolean;
    readonly enabled: boolean;
    readonly error: Error | undefined;
    readonly connection: ConnectionState;
    readonly details: QueryResultDetails;
    readonly infinite: InfiniteData | undefined;
    retry(): void;
    render<R>(handlers: RenderHandlers<T, R>): R;
}

export function useData<S extends Schema, D extends ContractMap, N extends keyof D & string, Row, One extends boolean>(
    selection: Selection<S, D, N, Row, One>,
    options: UseQueryOptions = {},
): Data<One extends true ? Row | undefined : readonly Row[]> {
    type Result = One extends true ? Row | undefined : readonly Row[];
    const zero = useZero<S, undefined, ClientContext>();
    const connection = useConnectionState();
    const identity = zero;
    const key = selection.key;
    const initial = selection.args.limit ?? selection.contract.defaultLimit;
    const [page, setPage] = useState({ key, identity, limit: initial });
    if (page.key !== key || page.identity !== identity) {
        setPage({ key, identity, limit: initial });
    }
    // A changed query/client uses its initial limit immediately, before effects.
    const limit = page.key === key && page.identity === identity ? page.limit : initial;
    const max = selection.contract.maxLimit;
    const requested = selection.pageSize === undefined ? selection.args.limit : Math.min(limit + 1, max);
    const request = useMemo(() => {
        if (selection.pageSize === undefined || selection.one) return selection.request();
        return (selection as Selection<S, D, N, Row>).limit(requested!).request() as ReturnType<
            typeof selection.request
        >;
    }, [selection, requested]);
    const [raw, details] = useQuery(request, options);
    const enabled = options.enabled ?? true;
    const decoded = useMemo(() => selection.decode(raw), [raw, selection]);
    const data = (
        selection.pageSize !== undefined && Array.isArray(decoded) ? decoded.slice(0, limit) : decoded
    ) as Result;
    const complete = details.type === 'complete';
    const hasData = Array.isArray(data) ? data.length > 0 : data !== undefined;
    const error = details.type === 'error' ? new Error(details.error.message) : undefined;
    const status: DataStatus = !enabled
        ? 'idle'
        : error
          ? hasData
              ? 'stale'
              : 'failure'
          : complete
            ? 'success'
            : hasData
              ? 'refreshing'
              : 'loading';
    const infinite: InfiniteData | undefined =
        selection.pageSize === undefined
            ? undefined
            : {
                  limit,
                  capped: limit >= max,
                  hasMore: Array.isArray(decoded) && decoded.length > limit ? true : complete ? false : undefined,
                  loadMore: () => {
                      if (
                          !enabled ||
                          details.type !== 'complete' ||
                          !Array.isArray(decoded) ||
                          decoded.length <= limit ||
                          limit >= max
                      )
                          return;
                      setPage({
                          key,
                          identity,
                          limit: Math.min(limit + selection.pageSize!, max),
                      });
                  },
              };
    return {
        data,
        status,
        complete,
        enabled,
        error,
        connection,
        details,
        infinite,
        retry: () => {
            if (details.type === 'error') details.retry();
        },
        render: (handlers) => {
            switch (status) {
                case 'idle':
                    return handlers.onIdle();
                case 'loading':
                    return handlers.onLoading();
                case 'refreshing':
                    return handlers.onRefreshing(data);
                case 'failure':
                    return handlers.onFailure(error!);
                case 'stale':
                    return handlers.onStale([data, error!]);
                default:
                    return handlers.onSuccess(data);
            }
        },
    };
}
