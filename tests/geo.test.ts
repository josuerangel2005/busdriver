import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_PARADAS, PLACEHOLDER_ROUTE } from '@/data/seed';
import { distanceBetweenM, routeLengthKm, snapToRoute } from '@/lib/geo';

describe('route helpers', () => {
  it('computes the route length in kilometers', () => {
    const length = routeLengthKm(PLACEHOLDER_ROUTE);
    expect(length).toBeGreaterThan(4);
    expect(length).toBeLessThan(7);
  });

  it('snaps a position to the route', () => {
    const snap = snapToRoute(PLACEHOLDER_ROUTE, {
      latitude: PLACEHOLDER_ROUTE.polyline[3].latitude,
      longitude: PLACEHOLDER_ROUTE.polyline[3].longitude,
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

  it('keeps stop coordinates close to the route', () => {
    for (const parada of PLACEHOLDER_PARADAS) {
      const snap = snapToRoute(PLACEHOLDER_ROUTE, {
        latitude: parada.lat,
        longitude: parada.lng,
      });
      expect(snap.distanceToRouteKm).toBeLessThan(0.1);
    }
  });
});
