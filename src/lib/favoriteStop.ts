type StopStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const keyFor = (routeId: string) => `passenger_favorite_stop:${routeId}`;

export function resolveFavoriteStop<T extends { id: string }>(
  stops: readonly T[], savedId: string | null,
): T | null {
  return stops.find((stop) => stop.id === savedId) ?? null;
}

export function favoriteFirst<T>(
  items: readonly T[], favoriteId: string | null, idOf: (item: T) => string,
): readonly T[] {
  const index = items.findIndex((item) => idOf(item) === favoriteId);
  return index > 0
    ? [...items.slice(index, index + 1), ...items.slice(0, index), ...items.slice(index + 1)]
    : items;
}

export async function readFavoriteStop(
  storage: Pick<StopStorage, 'getItem'>, routeId: string,
): Promise<string | null> {
  try {
    return (await storage.getItem(keyFor(routeId))) || null;
  } catch {
    return null;
  }
}

export async function saveFavoriteStop(storage: StopStorage, routeId: string, stopId: string | null) {
  try {
    if (stopId === null) await storage.removeItem(keyFor(routeId));
    else await storage.setItem(keyFor(routeId), stopId);
  } catch {
    // The in-memory preference remains usable.
  }
}
