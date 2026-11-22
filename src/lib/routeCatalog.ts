import { STORAGE_KEYS } from '@/constants/config';
import { PARADAS, ROUTES } from '@/data/seed';
import type { Parada, Ruta, Sentido } from '@/types/models';

export type CatalogData = { routes: Ruta[]; stops: Parada[] };
export type RouteCatalog = CatalogData & { source: 'remote' | 'cache' | 'bundled' };

type CatalogStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

type CatalogRepository = {
  subscribeRoutes(receive: (routes: unknown[]) => void): () => void;
  subscribeAllStops(receive: (stops: unknown[]) => void): () => void;
};

export const bundledCatalog: RouteCatalog = { routes: ROUTES, stops: PARADAS, source: 'bundled' };

export function findRoute(catalog: CatalogData, id: string | null | undefined): Ruta | undefined {
  return catalog.routes.find((route) => route.id === id);
}

export function findActiveRoute(catalog: CatalogData, id: string | null | undefined): Ruta | undefined {
  const route = findRoute(catalog, id);
  return route?.activa === false ? undefined : route;
}

export function activeRoutes(catalog: CatalogData): Ruta[] {
  return catalog.routes.filter((route) => route.activa !== false);
}

export function oppositeRoute(catalog: CatalogData, route: Ruta): Ruta | undefined {
  return activeRoutes(catalog).find((other) => other.linea_id === route.linea_id && other.sentido !== route.sentido);
}

export function stopsFor(catalog: CatalogData, routeId: string | undefined): Parada[] {
  return catalog.stops.filter((stop) => stop.ruta_id === routeId).sort((a, b) => a.orden - b.orden);
}

export function linesOf(catalog: CatalogData, preferredDirection?: Sentido): Ruta[] {
  const lines = new Map<string, Ruta>();
  for (const route of activeRoutes(catalog)) {
    const current = lines.get(route.linea_id);
    if (!current || (current.sentido !== preferredDirection && route.sentido === preferredDirection)) {
      lines.set(route.linea_id, route);
    }
  }
  return [...lines.values()];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRoute(value: unknown): value is Ruta {
  return record(value) && nonempty(value.id) && nonempty(value.linea_id)
    && nonempty(value.nombre) && nonempty(value.linea_nombre)
    && (value.sentido === 'ida' || value.sentido === 'vuelta')
    && (value.activa === undefined || typeof value.activa === 'boolean')
    && Array.isArray(value.polyline) && value.polyline.length >= 2
    && Array.from(value.polyline).every((point) =>
      record(point) && finite(point.latitude) && finite(point.longitude),
    );
}

function isStop(value: unknown): value is Parada {
  return record(value) && nonempty(value.id) && nonempty(value.ruta_id) && nonempty(value.nombre)
    && finite(value.lat) && finite(value.lng) && finite(value.orden);
}

function validate(rawRoutes: unknown, rawStops: unknown): CatalogData | undefined {
  if (!Array.isArray(rawRoutes) || !Array.isArray(rawStops)) return;
  const routes = rawRoutes.filter(isRoute);
  if (!routes.length) return;
  const routeIds = new Set(routes.map((route) => route.id));
  const stops = rawStops.filter((stop): stop is Parada => isStop(stop) && routeIds.has(stop.ruta_id));
  return { routes, stops };
}

export async function loadOfflineCatalog(storage: Pick<CatalogStorage, 'getItem'>): Promise<RouteCatalog> {
  try {
    const raw = await storage.getItem(STORAGE_KEYS.routeCatalog);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    const data = record(parsed) && validate(parsed.routes, parsed.stops);
    if (data) return { ...data, source: 'cache' };
  } catch {
    // Missing, corrupt or unavailable storage must not prevent offline use.
  }
  return bundledCatalog;
}

let cacheWrite = Promise.resolve();

export function startRouteCatalog(
  storage: CatalogStorage,
  repository: CatalogRepository,
  receive: (catalog: RouteCatalog) => void,
): () => void {
  let disposed = false;
  const subscriptions: (() => void)[] = [];
  let routes: unknown[] | undefined;
  let stops: unknown[] | undefined;

  function publish() {
    if (disposed) return;
    const data = validate(routes, stops);
    if (!data) return;
    receive({ ...data, source: 'remote' });
    cacheWrite = cacheWrite.then(async () => {
      try {
        await storage.setItem(STORAGE_KEYS.routeCatalog, JSON.stringify(data));
      } catch {
        // Keep the live catalog even when the offline copy cannot be written.
      }
    });
  }

  void loadOfflineCatalog(storage).then((catalog) => {
    if (disposed) return;
    receive(catalog);
    subscriptions.push(repository.subscribeRoutes((next) => {
      routes = next;
      publish();
    }));
    subscriptions.push(repository.subscribeAllStops((next) => {
      stops = next;
      publish();
    }));
  });

  return () => {
    disposed = true;
    subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  };
}
