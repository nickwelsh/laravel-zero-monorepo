import type { ProviderOptions } from '@nickwelsh/zero-for-laravel/react';

const origin = import.meta.env.VITE_APP_URL;
export const options = {
    cacheURL: import.meta.env.VITE_ZERO_CACHE_URL,
    queryURL: `${origin}/zero/query`,
    mutateURL: `${origin}/zero/mutate`,
} satisfies ProviderOptions;
