import { describe, expect, it } from 'vitest';

import { bundledCatalog, findRoute } from '@/lib/routeCatalog';
import { routeLengthKm } from '@/lib/geo';
import {
  advanceVehicle,
  DEMO_VEHICLES,
  demoHeadwayMinutes,
  isInSignalLoss,
  positionAt,
  type SimVehicle,
} from '@/services/mockSimulator';

const directRoute = findRoute(bundledCatalog, 'directo-cucuta-ida')!;

describe('advanceVehicle', () => {
  it('advances by speed multiplied by elapsed time', () => {
    const vehicle: SimVehicle = {
      vehiculo_id: 'test',
      rutaId: directRoute.id,
      progressKm: 0,
      speedMps: 5,
    };

    const advanced = advanceVehicle(vehicle, 2_000);
    expect(advanced.progressKm).toBeCloseTo(0.01, 6);

  });
});

describe('positionAt', () => {
  it('maps 0 and the route length to the polyline endpoints', () => {
    const totalKm = routeLengthKm(directRoute);
    const first = directRoute.polyline[0];
    const last = directRoute.polyline[directRoute.polyline.length - 1];

    const start = positionAt(directRoute, 0);
    expect(start.lat).toBeCloseTo(first.latitude, 5);
    expect(start.lng).toBeCloseTo(first.longitude, 5);

    const end = positionAt(directRoute, totalKm);
    expect(end.lat).toBeCloseTo(last.latitude, 5);
    expect(end.lng).toBeCloseTo(last.longitude, 5);
  });
});

describe('isInSignalLoss', () => {
  it('is false when not configured and true during the last 45 s of each 180 s window', () => {
    const plain: SimVehicle = {
      vehiculo_id: 'test',
      rutaId: directRoute.id,
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
  it('spaces the fleet around each round trip near its published headway', () => {
    const headways = { 'directo-cucuta': [6, 10], 'campo-verde': [15, 20], natura: [15, 20] } as const;
    for (const [id, [min, max]] of Object.entries(headways)) {
      const ida = findRoute(bundledCatalog, `${id}-ida`)!;
      const length = routeLengthKm(ida);
      const roundTripKm = length + routeLengthKm(findRoute(bundledCatalog, `${id}-vuelta`)!);
      const fleet = DEMO_VEHICLES.filter((bus) => findRoute(bundledCatalog, bus.rutaId)?.linea_id === id);
      expect(fleet.some((bus) => bus.rutaId === ida.id)).toBe(true);
      expect(fleet.some((bus) => bus.rutaId !== ida.id)).toBe(true);
      fleet.forEach((bus, index) => {
        const spacing = roundTripKm / fleet.length;
        const minutes = spacing * 1000 / bus.speedMps / 60;
        expect(minutes).toBeGreaterThanOrEqual(min);
        expect(minutes).toBeLessThanOrEqual(max);
        expect(bus.progressKm + (bus.rutaId === ida.id ? 0 : length)).toBeCloseTo(index * spacing);
      });
    }

    const lossy = DEMO_VEHICLES.filter((v) => v.signalLossEveryMs != null);
    expect(lossy.map((v) => v.vehiculo_id)).toEqual(['demo-buseta-3']);
    expect(lossy[0]).toMatchObject({
      signalLossEveryMs: 180_000,
      signalLossDurationMs: 45_000,
    });
  });
});

it('uses the simulated 120-minute Claret headway over its asymmetric round trip', () => {
  const ida = findRoute(bundledCatalog, 'ruta-1-claret-campus-ida')!;
  const vuelta = findRoute(bundledCatalog, 'ruta-1-claret-campus-vuelta')!;
  const fleet = DEMO_VEHICLES.filter((bus) => bus.rutaId === ida.id || bus.rutaId === vuelta.id);
  expect(fleet).toHaveLength(2);
  const roundTripKm = routeLengthKm(ida) + routeLengthKm(vuelta);
  for (const bus of fleet) {
    expect(roundTripKm * 1000 / fleet.length / bus.speedMps / 60).toBeCloseTo(120);
  }
});

it('uses a finite positive demo headway for unknown line ids', () => {
  for (const lineId of ['unknown', 'constructor']) {
    const minutes = demoHeadwayMinutes(lineId);
    expect(Number.isFinite(minutes)).toBe(true);
    expect(minutes).toBeGreaterThan(0);
  }
});
