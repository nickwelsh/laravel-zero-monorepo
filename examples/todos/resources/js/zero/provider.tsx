import { ZeroProvider } from '@laravel-zero/client/react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { mutators, schema } from './generated';

export function TodosZeroProvider({ userId, children }: { userId: number; children: ReactNode }) {
    const context = useMemo(() => ({ user_id: userId }), [userId]);
    const origin = import.meta.env.VITE_APP_URL;

    return (
        <ZeroProvider
            key={userId}
            schema={schema}
            mutators={mutators}
            userID={String(userId)}
            context={context}
            cacheURL={import.meta.env.VITE_ZERO_CACHE_URL}
            queryURL={`${origin}/zero/query`}
            mutateURL={`${origin}/zero/mutate`}
        >
            {children}
        </ZeroProvider>
    );
}
