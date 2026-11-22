import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bundledCatalog, findRoute } from '@/lib/routeCatalog';
import { mockRepository, resetMockState } from '@/services/mockRepository';
import { DEMO_VEHICLES } from '@/services/mockSimulator';
import type { VehiculoActivo } from '@/types/models';

const directRoute = findRoute(bundledCatalog, 'directo-cucuta-ida')!;

const DEMO_IDS = DEMO_VEHICLES.map((bus) => bus.vehiculo_id).sort();

function captureVehicles() {
  const snapshots: VehiculoActivo[][] = [];
  const unsubscribe = mockRepository.subscribeVehicles((snapshot) => {
    snapshots.push(snapshot);
  });
  return { snapshots, unsubscribe };
}

function latest(snapshots: VehiculoActivo[][]) {
  return snapshots[snapshots.length - 1];
}

function findVehicle(snapshot: VehiculoActivo[], id: string) {
  return snapshot.find((vehicle) => vehicle.vehiculo_id === id);
}

beforeEach(() => {
  vi.useFakeTimers();
  resetMockState();
});

afterEach(() => {
  resetMockState();
  vi.useRealTimers();
});

describe('mockRepository vehicle simulation', () => {
  it('a passenger subscription alone receives all in-service demo vehicles that move on each tick', () => {
    const { snapshots } = captureVehicles();
    const initial = latest(snapshots);
    const inService = initial.filter(
      (vehicle) => vehicle.en_servicio,
    );

    expect(inService).toHaveLength(DEMO_IDS.length);
    expect(inService.map((vehicle) => vehicle.vehiculo_id).sort()).toEqual(DEMO_IDS);

    vi.advanceTimersByTime(3_000);
    const next = latest(snapshots);
    expect(next).not.toBe(initial);

    for (const id of DEMO_IDS) {
      const before = findVehicle(initial, id);
      const after = findVehicle(next, id);
      expect(before).toBeDefined();
      expect(after).toBeDefined();
      expect(after?.lat).not.toBe(before?.lat);
      expect(after?.lng).not.toBe(before?.lng);
      expect(after?.timestamp_ultima_actualizacion).toBeGreaterThan(
        before?.timestamp_ultima_actualizacion ?? 0,
      );
    }

    // demo-buseta-3 loses signal during the last 45 s of every 180 s window.
    vi.advanceTimersByTime(129_000);
    const beforeLoss = latest(snapshots);
    vi.advanceTimersByTime(3_000);
    const atLoss = latest(snapshots);
    const demo3Before = findVehicle(beforeLoss, 'demo-buseta-3');
    const demo3AtLoss = findVehicle(atLoss, 'demo-buseta-3');
    const demo1Before = findVehicle(beforeLoss, 'demo-buseta-1');
    const demo1AtLoss = findVehicle(atLoss, 'demo-buseta-1');

    expect(demo3AtLoss?.timestamp_ultima_actualizacion).toBe(
      demo3Before?.timestamp_ultima_actualizacion,
    );
    expect(demo1AtLoss?.timestamp_ultima_actualizacion).toBeGreaterThan(
      demo1Before?.timestamp_ultima_actualizacion ?? 0,
    );
  });

  it('moves a published in-service driver vehicle and stops it when service ends', async () => {
    const { snapshots } = captureVehicles();
    const driverId = 'uid-driver-1';

    await mockRepository.publishVehicle({
      vehiculo_id: driverId,
      lat: directRoute.polyline[0].latitude,
      lng: directRoute.polyline[0].longitude,
      timestamp_ultima_actualizacion: Date.now(),
      ruta_activa: directRoute.id,
      velocidad_actual: 0,
      en_servicio: true,
    });

    const published = findVehicle(latest(snapshots), driverId);
    expect(published).toBeDefined();

    vi.advanceTimersByTime(3_000);
    const moved = findVehicle(latest(snapshots), driverId);
    expect(moved?.lat).not.toBe(published?.lat);
    expect(moved?.lng).not.toBe(published?.lng);
    expect(moved?.velocidad_actual).toBe(7);

    await mockRepository.setService(driverId, false);
    const stopped = findVehicle(latest(snapshots), driverId);
    const demoBefore = DEMO_IDS.map((id) => findVehicle(latest(snapshots), id));

    vi.advanceTimersByTime(3_000);
    const after = latest(snapshots);
    const driverAfter = findVehicle(after, driverId);

    expect(driverAfter?.lat).toBe(stopped?.lat);
    expect(driverAfter?.lng).toBe(stopped?.lng);

    DEMO_IDS.forEach((id, index) => {
      const demoAfter = findVehicle(after, id);
      expect(demoAfter?.lat).not.toBe(demoBefore[index]?.lat);
    });
  });

  it('publishes a driver direction change without ending service or moving the bus immediately', async () => {
    const { snapshots } = captureVehicles();
    const route = findRoute(bundledCatalog, 'campo-verde-ida')!;
    const terminus = route.polyline.at(-1)!;
    const bus = {
      vehiculo_id: 'driver',
      lat: terminus.latitude,
      lng: terminus.longitude,
      timestamp_ultima_actualizacion: Date.now(),
      ruta_activa: route.id,
      velocidad_actual: 0,
      en_servicio: true,
    };
    await mockRepository.publishVehicle(bus);
    vi.advanceTimersByTime(3_000);
    expect(findVehicle(latest(snapshots), 'driver')?.ruta_activa).toBe(route.id);

    await mockRepository.setVehicleRoute('driver', 'campo-verde-vuelta');
    expect(findVehicle(latest(snapshots), 'driver')).toMatchObject({
      ruta_activa: 'campo-verde-vuelta',
      en_servicio: true,
      lat: terminus.latitude,
      lng: terminus.longitude,
    });

    vi.advanceTimersByTime(3_000);
    const moved = findVehicle(latest(snapshots), 'driver');
    expect(moved?.ruta_activa).toBe('campo-verde-vuelta');
    expect(moved?.lat).not.toBe(terminus.latitude);
  });

  it('leaves no timers once the only listener unsubscribes and no driver vehicle is in service', () => {
    const { unsubscribe } = captureVehicles();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('mockRepository consent', () => {
  it('getConsent returns what saveConsent stored', async () => {
    const consent = { aceptado: true, version: '2026-01', timestamp: 123 };
    await mockRepository.saveConsent('uid-1', consent);

    await expect(mockRepository.getConsent('uid-1')).resolves.toEqual(consent);
    await expect(mockRepository.getConsent('uid-unknown')).resolves.toBeNull();
  });
});

it('reports the simulated connection as online immediately', () => {
  const receive = vi.fn();
  const unsubscribe = mockRepository.subscribeConnection(receive);
  expect(receive).toHaveBeenCalledExactlyOnceWith(true);
  unsubscribe();
});
