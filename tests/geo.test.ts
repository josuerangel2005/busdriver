import { describe, expect, it } from 'vitest';

import { PARADAS } from '@/data/seed';
import { bundledCatalog, findRoute } from '@/lib/routeCatalog';
import { distanceBetweenM, routeLengthKm, snapToRoute } from '@/lib/geo';

const directRoute = findRoute(bundledCatalog, 'directo-cucuta-ida')!;
const directStops = PARADAS.filter((stop) => stop.ruta_id === directRoute.id);

describe('route helpers', () => {
  it('computes the route length in kilometers', () => {
    const length = routeLengthKm(directRoute);
    expect(length).toBeGreaterThan(11);
    expect(length).toBeLessThan(12);
  });

  it('snaps a position to the route', () => {
    const snap = snapToRoute(directRoute, {
      latitude: directRoute.polyline[3].latitude,
      longitude: directRoute.polyline[3].longitude,
    });
    expect(snap.distanceToRouteKm).toBeLessThan(0.001);
    expect(snap.alongKm).toBeGreaterThan(0);
  });

  it('measures distance between two coordinates in meters', () => {
    const meters = distanceBetweenM(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.01 },
    );
    expect(meters).toBeGreaterThan(1100);
    expect(meters).toBeLessThan(1120);
  });

  it('has six ordered stops within 60 m of the route', () => {
    expect(directStops.map(({ id, orden }) => [id, orden])).toEqual(
      Array.from({ length: 6 }, (_, index) => [`${directRoute.id}-0${index + 1}`, index + 1]),
    );

    let previousAlongKm = -1;
    for (const parada of directStops) {
      const snap = snapToRoute(directRoute, {
        latitude: parada.lat,
        longitude: parada.lng,
      });
      expect(snap.distanceToRouteKm).toBeLessThanOrEqual(0.06);
      expect(snap.alongKm).toBeGreaterThan(previousAlongKm);
      previousAlongKm = snap.alongKm;
    }
  });
});
