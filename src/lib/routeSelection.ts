import { DEFAULT_ROUTE_ID, STORAGE_KEYS } from '@/constants/config';
import { findRoute } from '@/data/seed';

type RouteStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export function resolveRouteId(routeId: string | null | undefined): string {
  return findRoute(routeId ?? undefined)?.id ?? DEFAULT_ROUTE_ID;
}

export async function loadPassengerRoute(storage: RouteStorage): Promise<string> {
  try {
    return resolveRouteId(await storage.getItem(STORAGE_KEYS.passengerRoute));
  } catch {
    return DEFAULT_ROUTE_ID;
  }
}

export async function savePassengerRoute(storage: RouteStorage, routeId: string): Promise<void> {
  try {
    await storage.setItem(STORAGE_KEYS.passengerRoute, routeId);
  } catch {
    // The current selection remains usable even if storage is unavailable.
  }
}
