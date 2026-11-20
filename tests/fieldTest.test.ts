import { describe, expect, it } from 'vitest';

import {
  createLatencyTracker,
  etaErrorSeconds,
  latencyMs,
  summarizeEtaErrors,
  summarizeLatencies,
  summarizePings,
  toCsv,
} from '@/lib/fieldTest';
import type { EtaTrialLog, LatencyLog, PingLog } from '@/lib/fieldTest';
import type { VehiculoActivo } from '@/types/models';

describe('summarizePings', () => {
  it('computes intervals between successful pings ordered by GPS timestamp', () => {
    const pings: PingLog[] = [
      { id: 'p1', vehiculo_id: 'v1', timestamp_gps: 25_000, enviado_en: 25_050, ok: true, error: null },
      { id: 'p2', vehiculo_id: 'v1', timestamp_gps: 6_000, enviado_en: 6_020, ok: true, error: null },
      { id: 'p3', vehiculo_id: 'v1', timestamp_gps: 12_000, enviado_en: 12_030, ok: true, error: null },
      { id: 'p4', vehiculo_id: 'v1', timestamp_gps: 18_000, enviado_en: 18_040, ok: false, error: 'falló' },
      { id: 'p5', vehiculo_id: 'v1', timestamp_gps: 1_000, enviado_en: 1_010, ok: true, error: null },
    ];

    const summary = summarizePings(pings);

    expect(summary.total).toBe(5);
    expect(summary.exitosos).toBe(4);
    expect(summary.fallidos).toBe(1);
    expect(summary.duracionMs).toBe(24_000);
    expect(summary.intervaloMaxMs).toBe(13_000);
    expect(summary.intervaloPromedioMs).toBe(8_000);
    expect(summary.porcentajeDentroMeta).toBeCloseTo(66.6667, 3);
  });

  it('returns null interval stats and zero duration with fewer than two successful pings', () => {
    expect(summarizePings([])).toEqual({
      total: 0,
      exitosos: 0,
      fallidos: 0,
      duracionMs: 0,
      intervaloMaxMs: null,
      intervaloPromedioMs: null,
      porcentajeDentroMeta: null,
    });

    expect(
      summarizePings([
        { id: 'a', vehiculo_id: 'v1', timestamp_gps: 5_000, enviado_en: 5_100, ok: true, error: null },
        { id: 'b', vehiculo_id: 'v1', timestamp_gps: 9_000, enviado_en: 9_100, ok: false, error: 'timeout' },
      ]),
    ).toEqual({
      total: 2,
      exitosos: 1,
      fallidos: 1,
      duracionMs: 0,
      intervaloMaxMs: null,
      intervaloPromedioMs: null,
      porcentajeDentroMeta: null,
    });
  });
});

describe('latency', () => {
  it('keeps negative latencies caused by clock skew', () => {
    expect(latencyMs(1_000, 800)).toBe(-200);
    expect(latencyMs(1_000, 1_200)).toBe(200);
  });

  it('summarizes average, max, p95 and the share within 15 s', () => {
    const logs: LatencyLog[] = [
      { id: 'l1', vehiculo_id: 'v1', timestamp_emision: 1_000, recibido_en: 800, latencia_ms: -200 },
      { id: 'l2', vehiculo_id: 'v1', timestamp_emision: 1_000, recibido_en: 3_000, latencia_ms: 2_000 },
      { id: 'l3', vehiculo_id: 'v1', timestamp_emision: 1_000, recibido_en: 6_000, latencia_ms: 5_000 },
      { id: 'l4', vehiculo_id: 'v1', timestamp_emision: 1_000, recibido_en: 21_000, latencia_ms: 20_000 },
    ];

    const summary = summarizeLatencies(logs);

    expect(summary.total).toBe(4);
    expect(summary.promedioMs).toBe(6_700);
    expect(summary.maxMs).toBe(20_000);
    expect(summary.p95Ms).toBe(20_000);
    expect(summary.porcentajeDentroMeta).toBe(75);
  });

  it('returns nulls when there are no latency logs', () => {
    expect(summarizeLatencies([])).toEqual({
      total: 0,
      promedioMs: null,
      maxMs: null,
      p95Ms: null,
      porcentajeDentroMeta: null,
    });
  });
});

describe('createLatencyTracker', () => {
  function vehiculo(
    overrides: Partial<VehiculoActivo> = {},
  ): VehiculoActivo {
    return {
      vehiculo_id: 'v1',
      lat: 0,
      lng: 0,
      timestamp_ultima_actualizacion: 1_000,
      ruta_activa: 'r1',
      velocidad_actual: 0,
      en_servicio: true,
      ...overrides,
    };
  }

  it('seeds the baseline with the first emission and does not log it', () => {
    const track = createLatencyTracker();

    expect(track([vehiculo({ timestamp_ultima_actualizacion: 1_000 })], 5_000)).toEqual(
      [],
    );
  });

  it('logs a later emission with a new timestamp once and dedupes repeats', () => {
    const track = createLatencyTracker();
    const initial = vehiculo({ timestamp_ultima_actualizacion: 1_000 });
    const updated = vehiculo({ timestamp_ultima_actualizacion: 4_000 });

    track([initial], 5_000);

    expect(track([updated], 9_000)).toEqual([
      {
        vehiculo_id: 'v1',
        timestamp_emision: 4_000,
        recibido_en: 9_000,
        latencia_ms: 5_000,
      },
    ]);
    expect(track([updated], 12_000)).toEqual([]);
  });

  it('never logs vehicles out of service but still updates their baseline', () => {
    const track = createLatencyTracker();

    expect(
      track(
        [vehiculo({ timestamp_ultima_actualizacion: 1_000, en_servicio: false })],
        5_000,
      ),
    ).toEqual([]);
    expect(
      track(
        [vehiculo({ timestamp_ultima_actualizacion: 2_000, en_servicio: false })],
        6_000,
      ),
    ).toEqual([]);

    expect(
      track(
        [vehiculo({ timestamp_ultima_actualizacion: 3_000, en_servicio: true })],
        7_000,
      ),
    ).toEqual([
      {
        vehiculo_id: 'v1',
        timestamp_emision: 3_000,
        recibido_en: 7_000,
        latencia_ms: 4_000,
      },
    ]);
  });
});

describe('etaErrorSeconds', () => {
  const base = { id: 't1', parada_id: 'p1', vehiculo_id: 'v1' };

  it('returns a positive error when the vehicle arrives late', () => {
    expect(
      etaErrorSeconds({ ...base, inicio: 0, eta_predicha_s: 240, llegada: 300_000 }),
    ).toBe(60);
  });

  it('returns a negative error when the vehicle arrives early', () => {
    expect(
      etaErrorSeconds({ ...base, inicio: 0, eta_predicha_s: 240, llegada: 180_000 }),
    ).toBe(-60);
  });

  it('returns null when there was no prediction', () => {
    expect(
      etaErrorSeconds({ ...base, inicio: 0, eta_predicha_s: null, llegada: 300_000 }),
    ).toBeNull();
  });
});

describe('summarizeEtaErrors', () => {
  const trials: EtaTrialLog[] = [
    { id: 't1', parada_id: 'p1', vehiculo_id: 'v1', inicio: 0, eta_predicha_s: 240, llegada: 300_000 },
    { id: 't2', parada_id: 'p1', vehiculo_id: 'v1', inicio: 0, eta_predicha_s: 240, llegada: 180_000 },
    { id: 't3', parada_id: 'p1', vehiculo_id: 'v1', inicio: 0, eta_predicha_s: 100, llegada: 300_000 },
    { id: 't4', parada_id: 'p1', vehiculo_id: null, inicio: 0, eta_predicha_s: null, llegada: 300_000 },
  ];

  it('uses absolute errors, excludes trials without prediction and applies the 3 min target', () => {
    const summary = summarizeEtaErrors(trials);

    expect(summary.total).toBe(4);
    expect(summary.conPrediccion).toBe(3);
    expect(summary.errorAbsPromedioS).toBeCloseTo(106.6667, 3);
    expect(summary.errorAbsMaxS).toBe(200);
    expect(summary.porcentajeDentroMeta).toBeCloseTo(66.6667, 3);
  });

  it('returns null error stats when no trial has a prediction', () => {
    expect(summarizeEtaErrors([trials[3]])).toEqual({
      total: 1,
      conPrediccion: 0,
      errorAbsPromedioS: null,
      errorAbsMaxS: null,
      porcentajeDentroMeta: null,
    });
  });
});

describe('toCsv', () => {
  it('quotes commas, quotes and newlines and renders null as empty', () => {
    const csv = toCsv(
      ['a', 'b', 'c'],
      [
        ['plain', 1, true],
        ['with,comma', null, 'with "quote"'],
        ['line\nbreak', 'x', false],
      ],
    );

    expect(csv).toBe(
      'a,b,c\nplain,1,true\n"with,comma",,"with ""quote"""\n"line\nbreak",x,false',
    );
  });
});
