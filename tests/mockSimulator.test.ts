import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_ROUTE } from '@/data/seed';
import { routeLengthKm } from '@/lib/geo';
import {
  advanceVehicle,
  DEMO_VEHICLES,
  isInSignalLoss,
  positionAt,
  type SimVehicle,
} from '@/services/mockSimulator';

describe('advanceVehicle', () => {
  it('advances by speed*dt and wraps to 0 past the route length', () => {
    const totalKm = routeLengthKm(PLACEHOLDER_ROUTE);
    const vehicle: SimVehicle = {
      vehiculo_id: 'test',
      progressKm: 0,
      speedMps: 5,
    };

    const advanced = advanceVehicle(PLACEHOLDER_ROUTE, vehicle, 2_000);
    expect(advanced.progressKm).toBeCloseTo(0.01, 6);

    const nearEnd: SimVehicle = {
      vehiculo_id: 'test',
      progressKm: totalKm - 0.001,
      speedMps: 9,
    };
    const wrapped = advanceVehicle(PLACEHOLDER_ROUTE, nearEnd, 3_000);
    expect(wrapped.progressKm).toBe(0);
  });
});

describe('positionAt', () => {
  it('maps 0 and the route length to the polyline endpoints', () => {
    const totalKm = routeLengthKm(PLACEHOLDER_ROUTE);
    const first = PLACEHOLDER_ROUTE.polyline[0];
    const last = PLACEHOLDER_ROUTE.polyline[PLACEHOLDER_ROUTE.polyline.length - 1];

    const start = positionAt(PLACEHOLDER_ROUTE, 0);
    expect(start.lat).toBeCloseTo(first.latitude, 5);
    expect(start.lng).toBeCloseTo(first.longitude, 5);

    const end = positionAt(PLACEHOLDER_ROUTE, totalKm);
    expect(end.lat).toBeCloseTo(last.latitude, 5);
    expect(end.lng).toBeCloseTo(last.longitude, 5);
  });
});

describe('isInSignalLoss', () => {
  it('is false when not configured and true during the last 45 s of each 180 s window', () => {
    const plain: SimVehicle = {
      vehiculo_id: 'test',
      progressKm: 0,
      speedMps: 5,
    };
    expect(isInSignalLoss(plain, 10_000)).toBe(false);
    expect(isInSignalLoss(plain, 135_000)).toBe(false);

    const lossy: SimVehicle = {
      ...plain,
      signalLossEveryMs: 180_000,
      signalLossDurationMs: 45_000,
    };
    expect(isInSignalLoss(lossy, 134_999)).toBe(false);
    expect(isInSignalLoss(lossy, 135_000)).toBe(true);
    expect(isInSignalLoss(lossy, 179_999)).toBe(true);
    expect(isInSignalLoss(lossy, 180_000)).toBe(false);
    expect(isInSignalLoss(lossy, 315_000)).toBe(true);
  });
});

describe('DEMO_VEHICLES', () => {
  it('defines three distinct buses spread along the route with speeds between 5 and 9 m/s', () => {
    const totalKm = routeLengthKm(PLACEHOLDER_ROUTE);

    expect(DEMO_VEHICLES).toHaveLength(3);
    expect(new Set(DEMO_VEHICLES.map((v) => v.vehiculo_id))).toEqual(
      new Set(['demo-buseta-1', 'demo-buseta-2', 'demo-buseta-3']),
    );
    expect(new Set(DEMO_VEHICLES.map((v) => v.progressKm)).size).toBe(3);

    for (const vehicle of DEMO_VEHICLES) {
      expect(vehicle.progressKm).toBeGreaterThanOrEqual(0);
      expect(vehicle.progressKm).toBeLessThan(totalKm);
      expect(vehicle.speedMps).toBeGreaterThanOrEqual(5);
      expect(vehicle.speedMps).toBeLessThanOrEqual(9);
    }

    const lossy = DEMO_VEHICLES.filter((v) => v.signalLossEveryMs != null);
    expect(lossy.map((v) => v.vehiculo_id)).toEqual(['demo-buseta-3']);
    expect(lossy[0]).toMatchObject({
      signalLossEveryMs: 180_000,
      signalLossDurationMs: 45_000,
    });
  });
});
