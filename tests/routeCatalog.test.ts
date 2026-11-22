import { expect, it, vi } from 'vitest';

import { DEFAULT_ROUTE_ID } from '@/constants/config';
import { bundledCatalog, linesOf, loadOfflineCatalog, startRouteCatalog, stopsFor } from '@/lib/routeCatalog';
import { loadPassengerRoute, resolveRouteId, savePassengerRoute } from '@/lib/routeSelection';
import { changeShiftDirection } from '@/services/shift';

const ida = { ...bundledCatalog.routes[0], id: 'new-outbound', linea_id: 'new-line', sentido: 'ida' as const };
const vuelta = { ...ida, id: 'new-inbound', sentido: 'vuelta' as const };
const stop = { ...bundledCatalog.stops[0], ruta_id: ida.id };

function setup(raw: string | null = null) {
  let publishRoutes!: (value: unknown[]) => void;
  let publishStops!: (value: unknown[]) => void;
  const disposeRoutes = vi.fn();
  const disposeStops = vi.fn();
  const repository = {
    subscribeRoutes: (callback: typeof publishRoutes) => { publishRoutes = callback; return disposeRoutes; },
    subscribeAllStops: (callback: typeof publishStops) => { publishStops = callback; return disposeStops; },
  };
  const storage = { getItem: vi.fn().mockResolvedValue(raw), setItem: vi.fn().mockResolvedValue(undefined) };
  return { repository, storage, disposeRoutes, disposeStops, routes: (value: unknown[]) => publishRoutes(value), stops: (value: unknown[]) => publishStops(value) };
}

it('publishes cache before paired remote data, caches the result, and unsubscribes', async () => {
  const { repository, storage, routes, stops, disposeRoutes, disposeStops } = setup(JSON.stringify({ routes: [ida], stops: [stop] }));
  const receive = vi.fn();
  const unsubscribe = startRouteCatalog(storage, repository, receive);
  await vi.waitFor(() => expect(receive).toHaveBeenCalledWith({ routes: [ida], stops: [stop], source: 'cache' }));
  routes([ida, vuelta]);
  expect(receive).toHaveBeenCalledTimes(1);
  stops([stop]);
  expect(receive).toHaveBeenLastCalledWith({ routes: [ida, vuelta], stops: [stop], source: 'remote' });
  await vi.waitFor(() => expect(storage.setItem).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(vuelta.id)));
  unsubscribe();
  expect(disposeRoutes).toHaveBeenCalledTimes(1);
  expect(disposeStops).toHaveBeenCalledTimes(1);
});

it('falls back to bundled data headlessly when storage is absent, corrupt or unavailable', async () => {
  const { storage } = setup();
  await expect(loadOfflineCatalog(storage)).resolves.toBe(bundledCatalog);
  storage.getItem.mockResolvedValue('{');
  await expect(loadOfflineCatalog(storage)).resolves.toBe(bundledCatalog);
  storage.getItem.mockRejectedValue(new Error('offline'));
  await expect(loadOfflineCatalog(storage)).resolves.toBe(bundledCatalog);
});

it('drops malformed routes and stops and retains the last good catalog if routes become empty', async () => {
  const { repository, storage, routes, stops } = setup();
  const receive = vi.fn();
  const unsubscribe = startRouteCatalog(storage, repository, receive);
  await vi.waitFor(() => expect(receive).toHaveBeenCalledWith(bundledCatalog));
  routes([ida, null, { ...vuelta, polyline: [{}] }, { ...vuelta, id: '' }]);
  stops([stop, { ...stop, ruta_id: 'missing' }, { ...stop, lat: 'invalid' }]);
  expect(receive).toHaveBeenLastCalledWith({ routes: [ida], stops: [stop], source: 'remote' });
  expect(stopsFor(receive.mock.lastCall![0], ida.id)).toEqual([stop]);
  routes([]);
  expect(receive).toHaveBeenCalledTimes(2);
  routes([vuelta]);
  expect(receive).toHaveBeenLastCalledWith({ routes: [vuelta], stops: [], source: 'remote' });
  unsubscribe();
});

it('lists only active lines, including one with no active route in the preferred direction', () => {
  const catalog = { routes: [{ ...ida, activa: false }, vuelta, { ...ida, linea_id: 'hidden', activa: false }], stops: [] };
  expect(linesOf(catalog, 'ida')).toEqual([vuelta]);
});

it('falls back to an active sibling for inactive or removed selections, then to the default', () => {
  const catalog = { routes: [...bundledCatalog.routes, { ...ida, activa: false }, vuelta], stops: [] };
  expect(resolveRouteId(ida.id, catalog)).toBe(vuelta.id);
  expect(resolveRouteId(ida.id, { ...catalog, routes: catalog.routes.filter((route) => route.id !== ida.id) }, ida.linea_id)).toBe(vuelta.id);
  expect(resolveRouteId('missing', catalog)).toBe(DEFAULT_ROUTE_ID);
});

it('restores the same line after a remote selection with an opaque ID disappears', async () => {
  let saved: string | null = null;
  const storage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: string) => { saved = value; },
  };
  await savePassengerRoute(storage, ida.id, ida.linea_id);
  await expect(loadPassengerRoute(storage, { ...bundledCatalog, routes: [...bundledCatalog.routes, vuelta] }))
    .resolves.toBe(vuelta.id);
});

it('switches direction using the supplied catalog and rejects an inactive destination', async () => {
  const session = { vehiculoId: 'driver', rutaId: ida.id };
  const update = vi.fn();
  const catalog = { routes: [ida, vuelta], stops: [] };
  await expect(changeShiftDirection(update, session, vuelta.id, { ...catalog, routes: [ida, { ...vuelta, activa: false }] })).rejects.toThrow();
  expect(update).not.toHaveBeenCalled();
  await expect(changeShiftDirection(update, session, vuelta.id, catalog)).resolves.toEqual({ ...session, rutaId: vuelta.id });
  expect(update).toHaveBeenCalledExactlyOnceWith({ ...session, rutaId: vuelta.id });
});
