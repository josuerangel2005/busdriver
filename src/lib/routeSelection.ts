import { DEFAULT_ROUTE_ID, STORAGE_KEYS } from '@/constants/config';
import { activeRoutes, bundledCatalog, findRoute, type CatalogData } from '@/lib/routeCatalog';

type RouteStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type RouteSelection = { id: string; lineId?: string };

export function resolveRouteId(
  routeId: string | null | undefined,
  catalog: CatalogData = bundledCatalog,
  lineId?: string,
): string {
  const route = findRoute(catalog, routeId);
  if (route && route.activa !== false) return route.id;

  // Older installs stored only the ID of a bundled route.
  const preferredLine = route?.linea_id ?? lineId ?? findRoute(bundledCatalog, routeId)?.linea_id;
  const active = activeRoutes(catalog);
  return active.find((item) => item.linea_id === preferredLine)?.id
    ?? active.find((item) => item.id === DEFAULT_ROUTE_ID)?.id
    ?? active[0]?.id
    ?? DEFAULT_ROUTE_ID;
}

export async function readPassengerSelection(storage: RouteStorage): Promise<RouteSelection> {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.passengerRoute);
    if (raw?.startsWith('{')) {
      const choice = JSON.parse(raw);
      if (typeof choice?.id === 'string' && typeof choice.lineId === 'string') {
        return { id: choice.id, lineId: choice.lineId };
      }
    } else if (raw) {
      return { id: raw };
    }
  } catch {
    // Unavailable or corrupt storage is equivalent to no saved selection.
  }
  return { id: DEFAULT_ROUTE_ID };
}

export async function loadPassengerRoute(storage: RouteStorage, catalog = bundledCatalog): Promise<string> {
  const { id, lineId } = await readPassengerSelection(storage);
  return resolveRouteId(id, catalog, lineId);
}

export async function savePassengerRoute(storage: RouteStorage, routeId: string, lineId?: string): Promise<void> {
  try {
    const value = lineId ? JSON.stringify({ id: routeId, lineId }) : routeId;
    await storage.setItem(STORAGE_KEYS.passengerRoute, value);
  } catch {
    // The current selection remains usable even if storage is unavailable.
  }
}
