import { describe, expect, it } from 'vitest';

import {
  computeStopEtas,
  effectiveSpeedMps,
  estimateEtaSeconds,
  formatDistance,
  formatEta,
  isStale,
} from '@/lib/eta';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

const ruta: Ruta = {
  id: 'ruta-test',
  nombre: 'Ruta de prueba',
  polyline: [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.01 },
    { latitude: 0, longitude: 0.02 },
  ],
};

const paradas: Parada[] = [
  { id: 'p1', ruta_id: 'ruta-test', nombre: 'Uno', lat: 0, lng: 0.01, orden: 1 },
  { id: 'p2', ruta_id: 'ruta-test', nombre: 'Dos', lat: 0, lng: 0.02, orden: 2 },
];

function vehicle(overrides: Partial<VehiculoActivo> = {}): VehiculoActivo {
  return {
    vehiculo_id: 'v1',
    lat: 0,
    lng: 0.005,
    timestamp_ultima_actualizacion: Date.now(),
    ruta_activa: 'ruta-test',
    velocidad_actual: 10,
    en_servicio: true,
    ...overrides,
  };
}

describe('estimateEtaSeconds', () => {
  it('divides distance by speed', () => {
    expect(estimateEtaSeconds(1000, 10)).toBe(100);
  });

  it('uses the fallback speed when the vehicle is stopped', () => {
    const eta = estimateEtaSeconds(1000, 0);
    expect(eta).toBeCloseTo(1000 / 5.5, 5);
  });

  it('returns null for invalid distances', () => {
    expect(estimateEtaSeconds(-1, 10)).toBeNull();
    expect(estimateEtaSeconds(Number.NaN, 10)).toBeNull();
  });
});

describe('effectiveSpeedMps', () => {
  it('keeps usable speeds', () => {
    expect(effectiveSpeedMps(12)).toBe(12);
  });

  it('replaces low speeds with the fallback', () => {
    expect(effectiveSpeedMps(0.2)).toBe(5.5);
  });
});

describe('isStale', () => {
  it('flags data older than 30 seconds', () => {
    const now = 1_000_000;
    expect(isStale(now - 29_000, now)).toBe(false);
    expect(isStale(now - 31_000, now)).toBe(true);
  });
});

describe('computeStopEtas', () => {
  it('measures distance along the route, not straight line', () => {
    const now = Date.now();
    const [first, second] = computeStopEtas(ruta, paradas, vehicle(), now);

    expect(first.distanciaRestanteM).toBeGreaterThan(500);
    expect(first.distanciaRestanteM).toBeLessThan(600);
    expect(second.distanciaRestanteM).toBeGreaterThan(1600);
    expect(second.distanciaRestanteM).toBeLessThan(1700);
    expect(second.distanciaRestanteM).toBeGreaterThan(first.distanciaRestanteM);
  });

  it('calculates ETA from remaining distance and speed', () => {
    const now = Date.now();
    const [first] = computeStopEtas(ruta, paradas, vehicle({ velocidad_actual: 10 }), now);
    expect(first.etaSegundos).toBeCloseTo(first.distanciaRestanteM / 10, 5);
  });

  it('returns null ETA and marks the row as stale when data is old', () => {
    const now = Date.now();
    const [first] = computeStopEtas(
      ruta,
      paradas,
      vehicle({ timestamp_ultima_actualizacion: now - 60_000 }),
      now,
    );
    expect(first.desactualizado).toBe(true);
    expect(first.etaSegundos).toBeNull();
  });

  it('marks stops behind the vehicle as passed', () => {
    const now = Date.now();
    const [first, second] = computeStopEtas(
      ruta,
      paradas,
      vehicle({ lng: 0.015 }),
      now,
    );
    expect(first.pasada).toBe(true);
    expect(first.distanciaRestanteM).toBe(0);
    expect(second.pasada).toBe(false);
  });
});

describe('formatters', () => {
  it('formats ETA in minutes', () => {
    expect(formatEta(30)).toBe('menos de 1 min');
    expect(formatEta(600)).toBe('10 min');
    expect(formatEta(null)).toBe('—');
  });

  it('formats distances', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});
