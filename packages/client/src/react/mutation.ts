import { useZero } from '@rocicorp/zero/react';
import type { Schema, MutatorResult, MutatorResultDetails } from '@rocicorp/zero';
import { useEffect, useRef, useState } from 'react';
import type { ClientContext, ContractMap, MutationInput, Operation, RecordId } from '../contract';
import type { Mutation } from '../mutation';
import { InputError } from '../validation';

export type MutationState = {
    status: 'idle' | 'pending' | 'success' | 'failure';
    phase: 'client' | 'server' | undefined;
    error: Error | undefined;
    fields: Readonly<Record<string, readonly string[]>>;
};
export type MutationCall<ID extends string | number = string | number> = MutatorResult & { readonly id: ID };
export type MutationCallback<
    S extends Schema,
    D extends ContractMap,
    N extends keyof D & string,
    O extends Operation,
> = ((input: MutationInput<D, N, O>) => MutationCall<RecordId<D, N>>) & {
    readonly state: MutationState;
    readonly form: Mutation<S, D, N, O>['form'];
    reset(): void;
};
const idle: MutationState = {
    status: 'idle',
    phase: undefined,
    error: undefined,
    fields: {},
};

function fields(value: unknown): Readonly<Record<string, readonly string[]>> {
    if (
        !value ||
        typeof value !== 'object' ||
        !('fields' in value) ||
        !value.fields ||
        typeof value.fields !== 'object'
    )
        return {};
    return Object.fromEntries(
        Object.entries(value.fields).filter(
            (entry): entry is [string, string[]] =>
                Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'),
        ),
    );
}

export function useMutation<S extends Schema, D extends ContractMap, N extends keyof D & string, O extends Operation>(
    operation: Mutation<S, D, N, O>,
): MutationCallback<S, D, N, O> {
    const zero = useZero<S, undefined, ClientContext>();
    const [snapshot, setSnapshot] = useState({ zero, state: idle });
    const active = useRef({ zero, version: 0, mounted: true });
    useEffect(() => {
        active.current.mounted = true;
        return () => {
            active.current.mounted = false;
        };
    }, []);
    if (active.current.zero !== zero)
        active.current = {
            zero,
            version: active.current.version + 1,
            mounted: true,
        };
    const currentState = snapshot.zero === zero ? snapshot.state : idle;
    const callback = (input: MutationInput<D, N, O>): MutationCall<RecordId<D, N>> => {
        const version = ++active.current.version;
        const update = (next: MutationState) => {
            if (active.current.mounted && active.current.zero === zero && active.current.version === version)
                setSnapshot({ zero, state: next });
        };
        let request;
        try {
            request = operation.prepare(input);
        } catch (error) {
            update({
                status: 'failure',
                phase: 'client',
                error: error instanceof Error ? error : new Error(String(error)),
                fields:
                    error instanceof InputError
                        ? Object.fromEntries(Object.entries(error.fields).map(([key, value]) => [key, [value]]))
                        : {},
            });
            throw error;
        }
        update({
            status: 'pending',
            phase: 'client',
            error: undefined,
            fields: {},
        });
        let result: MutatorResult;
        try {
            result = zero.mutate(request);
        } catch (error) {
            update({
                status: 'failure',
                phase: 'client',
                error: error instanceof Error ? error : new Error(String(error)),
                fields: {},
            });
            throw error;
        }
        let serverSettled = false;
        let clientFailed = false;
        const observe = (phase: 'client' | 'server', outcome: MutatorResultDetails) => {
            if (phase === 'server') serverSettled = true;
            if (phase === 'client' && outcome.type === 'error') clientFailed = true;
            if (outcome.type === 'error')
                update({
                    status: 'failure',
                    phase,
                    error: new Error(outcome.error.message),
                    fields: outcome.error.type === 'app' ? fields(outcome.error.details) : {},
                });
            else if (phase === 'server' && !clientFailed)
                update({ status: 'success', phase, error: undefined, fields: {} });
            else if (phase === 'client' && !serverSettled)
                update({
                    status: 'pending',
                    phase: 'server',
                    error: undefined,
                    fields: {},
                });
            return outcome;
        };
        const rejected = (phase: 'client' | 'server', error: unknown): never => {
            update({
                status: 'failure',
                phase,
                error: error instanceof Error ? error : new Error(String(error)),
                fields: {},
            });
            throw error;
        };
        const client = result.client.then(
            (outcome) => observe('client', outcome),
            (error) => rejected('client', error),
        );
        const server = result.server.then(
            (outcome) => observe('server', outcome),
            (error) => rejected('server', error),
        );
        // State observes rejection even if callers only await the other completion.
        void client.catch(() => {});
        void server.catch(() => {});
        return { id: request.args.id, client, server };
    };
    return Object.assign(callback, {
        state: currentState,
        form: operation.form,
        reset: () => {
            active.current.version++;
            setSnapshot({ zero, state: idle });
        },
    });
}
