import { useZero } from '@rocicorp/zero/react';
import type { Schema, MutatorResult, MutatorResultDetails } from '@rocicorp/zero';
import { useEffect, useRef, useState } from 'react';
import type { ClientContext, ContractMap, Operation, RecordId } from '../contract';
import type { Mutation, OperationInput } from '../mutation';
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
    Bound extends boolean = false,
    Input = OperationInput<D, N, O, Bound>,
> = ((input: Input) => MutationCall<RecordId<D, N>>) & {
    readonly state: MutationState;
    readonly form: Mutation<S, D, N, O, Bound, Input>['form'] & MutationForm<Input>;
    readonly defaultValues: Partial<Input>;
    submit(event?: { preventDefault(): void }): MutationCall<RecordId<D, N>>;
    reset(): void;
};
type FormPath<T, Depth extends unknown[] = []> = Depth['length'] extends 8
    ? never
    : T extends Date
      ? never
      : T extends readonly (infer Item)[]
        ? `${number}` | `${number}.${FormPath<NonNullable<Item>, [...Depth, unknown]>}`
        : T extends object
          ? { [K in keyof T & string]: K | `${K}.${FormPath<NonNullable<T[K]>, [...Depth, unknown]>}` }[keyof T &
                string]
          : never;
type FormValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
        ? FormValue<NonNullable<T[Head]>, Rest>
        : T extends readonly (infer Item)[]
          ? FormValue<NonNullable<Item>, Rest>
          : never
    : P extends keyof T
      ? T[P]
      : T extends readonly (infer Item)[]
        ? Item
        : never;

export type MutationForm<Input> = {
    readonly values: Partial<Input>;
    readonly errors: MutationState['fields'];
    setValue<P extends FormPath<Input>>(field: P, value: FormValue<Input, P>): void;
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

export function useMutation<
    S extends Schema,
    D extends ContractMap,
    N extends keyof D & string,
    O extends Operation,
    Bound extends boolean = false,
    Input = OperationInput<D, N, O, Bound>,
>(operation: Mutation<S, D, N, O, Bound, Input>): MutationCallback<S, D, N, O, Bound, Input> {
    const zero = useZero<S, undefined, ClientContext>();
    const key = JSON.stringify([
        operation.name,
        operation.operation,
        operation.record?.[operation.contract.key],
        operation.nested,
    ]);
    const [snapshot, setSnapshot] = useState({ zero, key, state: idle });
    const [formState, setFormState] = useState(() => ({
        zero,
        key,
        defaults: operation.defaultValues,
        values: operation.defaultValues,
    }));
    const currentForm =
        formState.zero === zero && formState.key === key
            ? formState
            : { zero, key, defaults: operation.defaultValues, values: operation.defaultValues };
    if (currentForm !== formState) setFormState(currentForm);
    const active = useRef({ zero, key, version: 0, mounted: true });
    useEffect(() => {
        const current = active.current;
        if (current.zero !== zero || current.key !== key) return undefined;
        current.mounted = true;
        return () => {
            current.mounted = false;
        };
    }, [zero, key]);
    if (active.current.zero !== zero || active.current.key !== key)
        active.current = {
            zero,
            key,
            version: active.current.version + 1,
            mounted: true,
        };
    const currentState = snapshot.zero === zero && snapshot.key === key ? snapshot.state : idle;
    const callback = (input: Input): MutationCall<RecordId<D, N>> => {
        const version = ++active.current.version;
        const update = (next: MutationState) => {
            if (
                active.current.mounted &&
                active.current.zero === zero &&
                active.current.key === key &&
                active.current.version === version
            )
                setSnapshot({ zero, key, state: next });
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
                        ? Object.fromEntries(Object.entries(error.fields).map(([field, value]) => [field, [value]]))
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
        defaultValues: currentForm.defaults,
        form: {
            ...operation.form,
            values: currentForm.values,
            errors: currentState.fields,
            setValue: <P extends FormPath<Input>>(field: P, value: FormValue<Input, P>) =>
                setFormState((previous) => {
                    const base = previous.zero === zero && previous.key === key ? previous : currentForm;
                    const values = structuredClone(base.values) as Record<string, unknown>;
                    const parts = field.split('.');
                    if (parts.some((part) => ['__proto__', 'prototype', 'constructor'].includes(part)))
                        throw new InputError({ [field]: 'Invalid form field.' });
                    let target: Record<string, unknown> = values;
                    for (const [index, part] of parts.slice(0, -1).entries()) {
                        target[part] ??= /^\d+$/.test(parts[index + 1]!) ? [] : {};
                        target = target[part] as Record<string, unknown>;
                    }
                    target[parts.at(-1)!] = value;
                    return { ...base, values: values as Partial<Input> };
                }),
        },
        submit: (event?: { preventDefault(): void }) => {
            event?.preventDefault();
            const values = operation.formValues(currentForm.values, currentForm.defaults);
            return callback(values as Input);
        },
        reset: () => {
            active.current.version++;
            setSnapshot({ zero, key, state: idle });
            setFormState({ zero, key, defaults: operation.defaultValues, values: operation.defaultValues });
        },
    });
}
