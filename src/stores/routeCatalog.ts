import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { USE_MOCK } from '@/constants/config';
import { bundledCatalog, startRouteCatalog, type RouteCatalog } from '@/lib/routeCatalog';
import { getRepository } from '@/services/repository';

export const useRouteCatalog = create<{ catalog: RouteCatalog; ready: boolean }>(() => ({
  catalog: bundledCatalog,
  ready: USE_MOCK,
}));

export function connectRouteCatalog(): () => void {
  const storage = USE_MOCK ? { getItem: async () => null, setItem: async () => {} } : AsyncStorage;
  return startRouteCatalog(storage, getRepository(), (catalog) => {
    useRouteCatalog.setState({ catalog, ready: true });
  });
}
