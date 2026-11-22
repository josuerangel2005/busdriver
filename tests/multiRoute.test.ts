import { expect, it, vi } from 'vitest';

import { DEFAULT_ROUTE_ID } from '@/constants/config';
import * as seed from '@/data/seed';
import { computeBestStopEtas, computeStopEtas, vehiclesForRoute } from '@/lib/eta';
import { routeLengthKm, snapToRoute, distanceBetweenM } from '@/lib/geo';
import { loadPassengerRoute, savePassengerRoute } from '@/lib/routeSelection';
import { advanceVehicle, positionAt } from '@/services/mockSimulator';
import { mockRepository } from '@/services/mockRepository';
import { changeShiftDirection } from '@/services/shift';

it('lists six directions and pairs their ordered stops and exact reverse geometry', () => {
  const routes = vi.fn();
  mockRepository.subscribeRoutes(routes)();
  expect(routes).toHaveBeenCalledWith(seed.ROUTES);
  expect(seed.ROUTES).toHaveLength(6);
  for (const route of seed.ROUTES) {
    const stops = seed.PARADAS.filter((stop) => stop.ruta_id === route.id);
    expect(route.id).toBe(`${route.linea_id}-${route.sentido}`);
    expect(route.nombre).toBe(`${route.linea_nombre} · ${stops[0].nombre} → ${stops.at(-1)?.nombre}`);
    let previous = -1;
    stops.forEach((stop, index) => {
      expect(stop.orden).toBe(index + 1);
      const snap = snapToRoute(route, { latitude: stop.lat, longitude: stop.lng });
      expect(snap.distanceToRouteKm).toBeLessThanOrEqual(0.06);
      expect(snap.alongKm).toBeGreaterThan(previous);
      previous = snap.alongKm;
    });
    const reverse = seed.ROUTES.find((other) => other.linea_id === route.linea_id && other.sentido !== route.sentido);
    expect(reverse?.polyline).toEqual([...route.polyline].reverse());
    expect(seed.PARADAS.filter((stop) => stop.ruta_id === reverse?.id).map((stop) => stop.nombre))
      .toEqual(stops.map((stop) => stop.nombre).reverse());
  }
});

it('filters map vehicles and ignores other directions in ETA', () => {
  const route = seed.ROUTES[0];
  const [first, second] = route.polyline;
  const match = { vehiculo_id: 'match', ruta_activa: route.id, en_servicio: true, lat: first.latitude, lng: first.longitude, timestamp_ultima_actualizacion: 0, velocidad_actual: 7 };
  const other = { ...match, vehiculo_id: 'other', ruta_activa: seed.ROUTES[1].id, lat: second.latitude, lng: second.longitude };
  const stops = seed.PARADAS.filter((stop) => stop.ruta_id === route.id);
  expect(vehiclesForRoute([other, match, { ...match, en_servicio: false }], route.id)).toEqual([match]);
  expect(computeStopEtas(route, stops, other, 0)).toEqual([]);
  expect(computeBestStopEtas(route, stops, [other], 0)).toEqual([]);
  expect(computeBestStopEtas(route, stops, [other, match], 0).every((eta) => eta.vehiculoId === 'match')).toBe(true);
});

it('keeps the leftover distance when a demo bus crosses either terminus', () => {
  for (const route of seed.ROUTES) {
    const length = routeLengthKm(route);
    const bus = { vehiculo_id: 'test', rutaId: route.id, progressKm: length - 0.001, speedMps: 7 };
    const next = advanceVehicle(bus, 1000);
    const reverse = seed.ROUTES.find((item) => item.id === next.rutaId)!;
    expect(reverse.sentido).not.toBe(route.sentido);
    expect(reverse.linea_id).toBe(route.linea_id);
    expect(next.progressKm).toBeCloseTo(0.006);
    const before = positionAt(route, bus.progressKm);
    const after = positionAt(reverse, next.progressKm);
    expect(distanceBetweenM({ latitude: before.lat, longitude: before.lng }, { latitude: after.lat, longitude: after.lng })).toBeLessThanOrEqual(7.01);
  }
});

it('restores a saved selection and falls back for missing, obsolete or unavailable storage', async () => {
  const routeId = 'natura-vuelta';
  const storage = { getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn() };
  await expect(loadPassengerRoute(storage)).resolves.toBe(DEFAULT_ROUTE_ID);
  storage.getItem.mockResolvedValue('unknown');
  await expect(loadPassengerRoute(storage)).resolves.toBe(DEFAULT_ROUTE_ID);
  storage.getItem.mockRejectedValue(new Error('unavailable'));
  await expect(loadPassengerRoute(storage)).resolves.toBe(DEFAULT_ROUTE_ID);
  await savePassengerRoute(storage, routeId);
  expect(storage.setItem).toHaveBeenCalledWith(expect.any(String), routeId);
  storage.getItem.mockResolvedValue(routeId);
  await expect(loadPassengerRoute(storage)).resolves.toBe(routeId);
  storage.setItem.mockRejectedValue(new Error('unavailable'));
  await expect(savePassengerRoute(storage, routeId)).resolves.toBeUndefined();
});

it('switches only within the active line without ending the shift', async () => {
  const session = { vehiculoId: 'driver', rutaId: 'campo-verde-ida' };
  const updateDirection = vi.fn();
  await expect(changeShiftDirection(updateDirection, session, 'natura-ida')).rejects.toThrow();
  expect(updateDirection).not.toHaveBeenCalled();
  const next = await changeShiftDirection(updateDirection, session, 'campo-verde-vuelta');
  expect(next).toEqual({ ...session, rutaId: 'campo-verde-vuelta' });
  expect(updateDirection).toHaveBeenCalledExactlyOnceWith(next);
});
