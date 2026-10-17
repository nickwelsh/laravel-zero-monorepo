import type { MutationCall } from '@nickwelsh/laravel-zero/react';
import { toast } from 'sonner';

export async function commitMutation(
    action: () => MutationCall,
    onSuccess?: (id: string | number) => void,
): Promise<void> {
    try {
        const call = action();
        const client = await call.client;
        if (client.type === 'error') throw new Error(client.error.message);
        const server = await call.server;
        if (server.type === 'error') throw new Error(server.error.message);
        onSuccess?.(call.id);
    } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to save the change.');
    }
}
