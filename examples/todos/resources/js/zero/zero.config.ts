import type { ProviderOptions } from '@laravel-zero/client/react';

const origin = import.meta.env.VITE_APP_URL;
export const options = {
    cacheURL: import.meta.env.VITE_ZERO_CACHE_URL,
    queryURL: `${origin}/zero/query`,
    mutateURL: `${origin}/zero/mutate`,
} satisfies ProviderOptions;
