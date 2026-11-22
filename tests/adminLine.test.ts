import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildLineUpdate, buildReturnRoute, lineIdFor, orderStops, parseOsrmRoute,
  routeOnStreets, snapAdminStop, validateLine,
} from '@/lib/adminLine';
import { activeRoutes, bundledCatalog, linesOf, startRouteCatalog, stopsFor } from '@/lib/routeCatalog';
import { resolveRouteId } from '@/lib/routeSelection';
import { mockRepository, resetMockState } from '@/services/mockRepository';

const a = { latitude: 0, longitude: 0 };
const b = { latitude: 0, longitude: 0.01 };
const points = [a, b];
const route = { id: 'test-ida', nombre: 'Prueba', linea_id: 'test', linea_nombre: 'Prueba', sentido: 'ida' as const, polyline: points };
const start = { point: a, name: 'Origen', alongKm: 0, idaId: 'test-ida-01', vueltaId: 'test-vuelta-02' };
const end = { point: b, name: 'Destino', alongKm: 1, idaId: 'test-ida-02', vueltaId: 'test-vuelta-01' };
const draft = { lineId: 'test', name: 'Prueba', polyline: points, waypoints: points, stops: [end, start], active: false };

afterEach(() => {
  vi.useRealTimers();
  resetMockState();
});

describe('admin line editor', () => {
  it('produces unique ASCII slugs, including reserved and empty slugs', () => {
    expect(lineIdFor(' Línea Ágil / 2 ', ['linea-agil-2', 'linea-agil-2-2'])).toBe('linea-agil-2-3');
    expect(lineIdFor('Nueva', [])).toBe('nueva-2');
    expect(lineIdFor('🚌', [])).toBe('linea');
  });

  it('orders stops by distance and reverses the route without mutating the ida', () => {
    expect(orderStops([end, start])).toEqual([start, end]);
    const result = buildReturnRoute({ ...route, waypoints: points }, draft.stops);
    expect(result).toMatchObject({
      route: { id: 'test-vuelta', sentido: 'vuelta', polyline: [b, a] },
      stops: [{ id: end.vueltaId, orden: 1 }, { id: start.vueltaId, orden: 2 }],
    });
    expect(result.route).not.toHaveProperty('waypoints');
    expect(route.polyline).toEqual(points);
  });

  it('writes records by ID only, retains references and deletes only obsolete stops of this line', () => {
    const prior = [
      { id: 'test-ida-p1', ruta_id: 'test-ida', nombre: 'Viejo', lat: 0, lng: 0, orden: 1 },
      { id: 'other-ida-p1', ruta_id: 'other-ida', nombre: 'Ajeno', lat: 0, lng: 0, orden: 1 },
    ];
    const update = buildLineUpdate({ ...draft, stops: [end, { ...start, idaId: undefined }] }, prior);
    expect(update).toMatchObject({
      'rutas/test-ida': { activa: false, nombre: 'Prueba · Origen → Destino', waypoints: points },
      'rutas/test-vuelta': { activa: false, polyline: [b, a] },
      'paradas/test-ida-p2': { ruta_id: 'test-ida', orden: 1 },
      'paradas/test-ida-02': { ruta_id: 'test-ida', orden: 2 },
      'paradas/test-vuelta-01': { ruta_id: 'test-vuelta', orden: 1 },
      'paradas/test-ida-p1': null,
    });
    expect(Object.keys(update).every((key) => /^(rutas|paradas)\/[^/]+$/.test(key))).toBe(true);
    expect(update['paradas/other-ida-p1']).toBeUndefined();
    expect(update['rutas/test-ida']).not.toHaveProperty('id');
    expect(update['rutas/test-vuelta']).not.toHaveProperty('waypoints');
  });

  it('preserves a line with mixed legacy direction states when saving', () => {
    const update = buildLineUpdate({ ...draft, returnActive: true }, []);
    expect(update['rutas/test-ida']?.activa).toBe(false);
    expect(update['rutas/test-vuelta']?.activa).toBe(true);
  });

  it('validates names, trace and stops; seeded traces need no stored waypoints', () => {
    expect(validateLine({ ...draft, waypoints: undefined })).toBeNull();
    expect(validateLine({ ...draft, name: ' '.repeat(2) })).toMatch(/Nombre de la línea/);
    expect(validateLine({ ...draft, name: 'x'.repeat(81) })).toMatch(/Nombre de la línea/);
    expect(validateLine({ ...draft, polyline: [a] })).toMatch(/dos puntos/);
    expect(validateLine({ ...draft, stops: [start] })).toMatch(/dos paraderos/);
    expect(validateLine({ ...draft, stops: [start, { ...end, name: 'x'.repeat(81) }] })).toMatch(/80/);
  });

  it('snaps nearby taps and rejects taps beyond 150 meters', () => {
    expect(snapAdminStop(points, { latitude: 0.001, longitude: 0.005 })?.location.latitude).toBeCloseTo(0);
    expect(snapAdminStop(points, { latitude: 0.0014, longitude: 0.005 })).toBeNull();
    expect(snapAdminStop([a], a)).toBeNull();
  });

  it('parses OSRM GeoJSON in longitude-latitude order and rejects malformed responses', async () => {
    const response = { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [0.01, 0]] } }] };
    expect(parseOsrmRoute(response)).toEqual(points);
    expect(parseOsrmRoute({ ...response, code: 'NoRoute' })).toBeNull();
    expect(parseOsrmRoute({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[0, 0], [181, 0]] } }] })).toBeNull();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, json: async () => response } as Response);
    await expect(routeOnStreets(points, fetcher)).resolves.toEqual({ polyline: points, adjusted: true });
    expect(fetcher).toHaveBeenCalledWith('https://router.project-osrm.org/route/v1/driving/0,0;0.01,0?overview=full&geometries=geojson', expect.anything());
  });

  it('falls back to straight segments on fetch errors and a 10-second timeout', async () => {
    const fallback = { polyline: points, adjusted: false };
    await expect(routeOnStreets(points, vi.fn<typeof fetch>().mockRejectedValue(new Error()))).resolves.toEqual(fallback);
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const pending = routeOnStreets(points, fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toEqual(fallback);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('publishes mock writes to the catalog and hides deactivated lines from selectors', async () => {
    let catalog = bundledCatalog;
    const disconnect = startRouteCatalog({ getItem: async () => null, setItem: async () => {} }, mockRepository, (value) => { catalog = value; });
    try {
      await vi.waitFor(() => expect(catalog.source).toBe('remote'));
      await mockRepository.saveLine(buildLineUpdate({ ...draft, active: true }, []));
      expect(stopsFor(catalog, 'test-vuelta').map((stop) => stop.nombre)).toEqual(['Destino', 'Origen']);
      expect(activeRoutes(catalog).filter((item) => item.linea_id === 'test')).toHaveLength(2);
      await mockRepository.setLineActive('test', false);
      expect(catalog.routes.filter((item) => item.linea_id === 'test').map((item) => item.activa)).toEqual([false, false]);
      expect(linesOf(catalog).some((item) => item.linea_id === 'test')).toBe(false);
      expect(resolveRouteId('test-ida', catalog)).not.toBe('test-ida');
      await mockRepository.setLineActive('test', true);
      expect(linesOf(catalog).some((item) => item.linea_id === 'test')).toBe(true);
    } finally {
      disconnect();
    }
  });
});

it('does not offer the default route to new shifts or passengers when all lines are inactive', async () => {
  const { findActiveRoute } = await import('@/lib/routeCatalog');
  for (const { linea_id } of linesOf(bundledCatalog)) {
    await mockRepository.setLineActive(linea_id, false);
  }
  const unsubscribe = mockRepository.subscribeRoutes((routes) => {
    const catalog = { ...bundledCatalog, routes };
    expect(linesOf(catalog)).toEqual([]);
    expect(findActiveRoute(catalog, resolveRouteId('directo-cucuta-ida', catalog))).toBeUndefined();
  });
  unsubscribe();
});
