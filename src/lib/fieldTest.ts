import {
  ETA_ERROR_TARGET_S,
  LATENCY_TARGET_MS,
  PING_TARGET_MS,
} from '@/constants/config';
import type { VehiculoActivo } from '@/types/models';

export type PingLog = {
  id: string;
  vehiculo_id: string;
  timestamp_gps: number;
  enviado_en: number;
  ok: boolean;
  error: string | null;
};

export type PingSummary = {
  total: number;
  exitosos: number;
  fallidos: number;
  duracionMs: number;
  intervaloMaxMs: number | null;
  intervaloPromedioMs: number | null;
  porcentajeDentroMeta: number | null;
};

export type LatencyLog = {
  id: string;
  vehiculo_id: string;
  timestamp_emision: number;
  recibido_en: number;
  latencia_ms: number;
};

export type LatencySummary = {
  total: number;
  promedioMs: number | null;
  maxMs: number | null;
  p95Ms: number | null;
  porcentajeDentroMeta: number | null;
};

export type EtaTrialLog = {
  id: string;
  parada_id: string;
  vehiculo_id: string | null;
  inicio: number;
  eta_predicha_s: number | null;
  llegada: number;
};

export type EtaErrorSummary = {
  total: number;
  conPrediccion: number;
  errorAbsPromedioS: number | null;
  errorAbsMaxS: number | null;
  porcentajeDentroMeta: number | null;
};

function percentWithin(values: number[], target: number): number | null {
  if (!values.length) {
    return null;
  }
  const within = values.filter((value) => value <= target).length;
  return (within / values.length) * 100;
}

export function summarizePings(pings: PingLog[]): PingSummary {
  const exitosos = pings.filter((ping) => ping.ok);
  const timestamps = exitosos
    .map((ping) => ping.timestamp_gps)
    .sort((a, b) => a - b);

  const intervals = timestamps
    .slice(1)
    .map((timestamp, index) => timestamp - timestamps[index]);
  const duracionMs =
    timestamps.length >= 2
      ? timestamps[timestamps.length - 1] - timestamps[0]
      : 0;

  return {
    total: pings.length,
    exitosos: timestamps.length,
    fallidos: pings.length - exitosos.length,
    duracionMs,
    intervaloMaxMs: intervals.length ? Math.max(...intervals) : null,
    intervaloPromedioMs: intervals.length
      ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      : null,
    porcentajeDentroMeta: percentWithin(intervals, PING_TARGET_MS),
  };
}

export function latencyMs(timestampEmision: number, recibidoEn: number): number {
  return recibidoEn - timestampEmision;
}

export function createLatencyTracker() {
  const lastSeen = new Map<string, number>();

  return (
    vehiculos: VehiculoActivo[],
    recibidoEn: number,
  ): Omit<LatencyLog, 'id'>[] => {
    const entries: Omit<LatencyLog, 'id'>[] = [];

    for (const vehiculo of vehiculos) {
      const emision = vehiculo.timestamp_ultima_actualizacion;
      if (lastSeen.get(vehiculo.vehiculo_id) === emision) {
        continue;
      }

      const hasBaseline = lastSeen.has(vehiculo.vehiculo_id);
      lastSeen.set(vehiculo.vehiculo_id, emision);

      if (!hasBaseline || vehiculo.en_servicio === false) {
        continue;
      }

      entries.push({
        vehiculo_id: vehiculo.vehiculo_id,
        timestamp_emision: emision,
        recibido_en: recibidoEn,
        latencia_ms: latencyMs(emision, recibidoEn),
      });
    }

    return entries;
  };
}

export function summarizeLatencies(logs: LatencyLog[]): LatencySummary {
  if (!logs.length) {
    return {
      total: 0,
      promedioMs: null,
      maxMs: null,
      p95Ms: null,
      porcentajeDentroMeta: null,
    };
  }

  const values = logs.map((log) => log.latencia_ms);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length);

  return {
    total: logs.length,
    promedioMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    maxMs: sorted[sorted.length - 1],
    p95Ms: sorted[Math.max(0, rank - 1)],
    porcentajeDentroMeta: percentWithin(values, LATENCY_TARGET_MS),
  };
}

export function etaErrorSeconds(trial: EtaTrialLog): number | null {
  if (trial.eta_predicha_s == null) {
    return null;
  }
  return (trial.llegada - trial.inicio) / 1000 - trial.eta_predicha_s;
}

export function summarizeEtaErrors(trials: EtaTrialLog[]): EtaErrorSummary {
  const errors = trials
    .map((trial) => etaErrorSeconds(trial))
    .filter((error): error is number => error != null)
    .map((error) => Math.abs(error));

  if (!errors.length) {
    return {
      total: trials.length,
      conPrediccion: 0,
      errorAbsPromedioS: null,
      errorAbsMaxS: null,
      porcentajeDentroMeta: null,
    };
  }

  return {
    total: trials.length,
    conPrediccion: errors.length,
    errorAbsPromedioS:
      errors.reduce((sum, error) => sum + error, 0) / errors.length,
    errorAbsMaxS: Math.max(...errors),
    porcentajeDentroMeta: percentWithin(errors, ETA_ERROR_TARGET_S),
  };
}

function formatCsvValue(value: string | number | boolean | null): string {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  header: string[],
  rows: (string | number | boolean | null)[][],
): string {
  const lines = [
    header.map(formatCsvValue).join(','),
    ...rows.map((row) => row.map(formatCsvValue).join(',')),
  ];
  return lines.join('\n');
}
