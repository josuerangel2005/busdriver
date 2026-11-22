import { describe, expect, it } from 'vitest';

import { PILOT_PARADAS, PILOT_ROUTE } from '@/data/seed';
import { distanceBetweenM, routeLengthKm, snapToRoute } from '@/lib/geo';

describe('route helpers', () => {
  it('computes the route length in kilometers', () => {
    const length = routeLengthKm(PILOT_ROUTE);
    expect(length).toBeGreaterThan(11);
    expect(length).toBeLessThan(12);
  });

  it('snaps a position to the route', () => {
    const snap = snapToRoute(PILOT_ROUTE, {
      latitude: PILOT_ROUTE.polyline[3].latitude,
      longitude: PILOT_ROUTE.polyline[3].longitude,
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
    expect(PILOT_PARADAS.map(({ id, orden }) => [id, orden])).toEqual(
      Array.from({ length: 6 }, (_, index) => [`parada-0${index + 1}`, index + 1]),
    );

    let previousAlongKm = -1;
    for (const parada of PILOT_PARADAS) {
      const snap = snapToRoute(PILOT_ROUTE, {
        latitude: parada.lat,
        longitude: parada.lng,
      });
      expect(snap.distanceToRouteKm).toBeLessThanOrEqual(0.06);
      expect(snap.alongKm).toBeGreaterThan(previousAlongKm);
      previousAlongKm = snap.alongKm;
    }
  });
});
