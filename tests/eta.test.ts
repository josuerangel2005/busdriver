import { describe, expect, it } from 'vitest';

import {
  computeBestStopEtas,
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

  it('includes the vehicle id in every row', () => {
    const [first] = computeStopEtas(
      ruta,
      paradas,
      vehicle({ vehiculo_id: 'v-test' }),
      Date.now(),
    );
    expect(first.vehiculoId).toBe('v-test');
  });
});

describe('computeBestStopEtas', () => {
  it('picks the nearest fresh vehicle that has not passed the stop', () => {
    const now = Date.now();
    const [, second] = computeBestStopEtas(
      ruta,
      paradas,
      [
        vehicle({ vehiculo_id: 'near', lng: 0.015 }),
        vehicle({ vehiculo_id: 'far', lng: 0.005 }),
      ],
      now,
    );

    expect(second.vehiculoId).toBe('near');
    expect(second.pasada).toBe(false);
    expect(second.desactualizado).toBe(false);
    expect(second.distanciaRestanteM).toBeGreaterThan(500);
    expect(second.distanciaRestanteM).toBeLessThan(600);
    expect(second.etaSegundos).toBeCloseTo(second.distanciaRestanteM / 10, 5);
  });

  it('ignores a fresh vehicle that already passed the stop', () => {
    const now = Date.now();
    const [first] = computeBestStopEtas(
      ruta,
      [paradas[0]],
      [
        vehicle({ vehiculo_id: 'passed', lng: 0.015 }),
        vehicle({ vehiculo_id: 'approaching', lng: 0.005 }),
      ],
      now,
    );

    expect(first.vehiculoId).toBe('approaching');
    expect(first.pasada).toBe(false);
    expect(first.distanciaRestanteM).toBeGreaterThan(500);
    expect(first.distanciaRestanteM).toBeLessThan(600);
  });

  it('prefers a fresh vehicle over a nearer stale one', () => {
    const now = Date.now();
    const [second] = computeBestStopEtas(
      ruta,
      [paradas[1]],
      [
        vehicle({
          vehiculo_id: 'stale',
          lng: 0.017,
          timestamp_ultima_actualizacion: now - 60_000,
        }),
        vehicle({ vehiculo_id: 'fresh', lng: 0.005 }),
      ],
      now,
    );

    expect(second.vehiculoId).toBe('fresh');
    expect(second.desactualizado).toBe(false);
    expect(second.etaSegundos).not.toBeNull();
  });

  it('falls back to stale vehicles that have not passed the stop', () => {
    const now = Date.now();
    const [first] = computeBestStopEtas(
      ruta,
      [paradas[0]],
      [
        vehicle({
          vehiculo_id: 'stale',
          lng: 0.005,
          timestamp_ultima_actualizacion: now - 60_000,
        }),
      ],
      now,
    );

    expect(first.vehiculoId).toBe('stale');
    expect(first.desactualizado).toBe(true);
    expect(first.etaSegundos).toBeNull();
    expect(first.pasada).toBe(false);
  });

  it('marks the stop as passed when every candidate passed it', () => {
    const now = Date.now();
    const [first] = computeBestStopEtas(
      ruta,
      [paradas[0]],
      [
        vehicle({ vehiculo_id: 'first', lng: 0.015 }),
        vehicle({ vehiculo_id: 'second', lng: 0.018 }),
      ],
      now,
    );

    expect(first.pasada).toBe(true);
    expect(first.etaSegundos).toBeNull();
    expect(first.distanciaRestanteM).toBe(0);
    expect(first.desactualizado).toBe(false);
    expect(first.vehiculoId).toBe('first');
  });

  it('ignores vehicles off duty or on another route', () => {
    const etas = computeBestStopEtas(
      ruta,
      paradas,
      [
        vehicle({ vehiculo_id: 'off', en_servicio: false }),
        vehicle({ vehiculo_id: 'other-route', ruta_activa: 'otra-ruta' }),
      ],
      Date.now(),
    );

    expect(etas).toEqual([]);
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
