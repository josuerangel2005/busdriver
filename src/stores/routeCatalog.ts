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
  if (USE_MOCK) return () => undefined;
  return startRouteCatalog(AsyncStorage, getRepository(), (catalog) => {
    useRouteCatalog.setState({ catalog, ready: true });
  });
}
