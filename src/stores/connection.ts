import { create } from 'zustand';

import { getRepository, type Repository } from '@/services/repository';

export type ConnectionStatus = 'unknown' | 'online' | 'offline';

export const useConnection = create<{ status: ConnectionStatus }>(() => ({ status: 'unknown' }));

export function connectConnection(
  subscribe: Repository['subscribeConnection'] = getRepository().subscribeConnection,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = subscribe((online) => {
    if (online) {
      clearTimeout(timer);
      timer = undefined;
      useConnection.setState({ status: 'online' });
    } else if (timer === undefined && useConnection.getState().status !== 'offline') {
      timer = setTimeout(() => {
        timer = undefined;
        useConnection.setState({ status: 'offline' });
      }, 3000);
    }
  });

  return () => {
    unsubscribe();
    clearTimeout(timer);
    useConnection.setState({ status: 'unknown' });
  };
}
