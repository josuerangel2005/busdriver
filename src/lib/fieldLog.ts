import * as SQLite from 'expo-sqlite';

import {
  toCsv,
  type EtaTrialLog,
  type LatencyLog,
  type PingLog,
} from './fieldTest';
import { exportCsvFile } from './metrics';

type PingRow = {
  id: string;
  vehiculo_id: string;
  timestamp_gps: number;
  enviado_en: number;
  ok: number;
  error: string | null;
};

type LatencyRow = {
  id: string;
  vehiculo_id: string;
  timestamp_emision: number;
  recibido_en: number;
  latencia_ms: number;
};

type EtaTrialRow = {
  id: string;
  parada_id: string;
  vehiculo_id: string | null;
  inicio: number;
  eta_predicha_s: number | null;
  llegada: number;
};

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('metricas.db');
    db.execSync(
      'CREATE TABLE IF NOT EXISTS pings (id TEXT PRIMARY KEY NOT NULL, vehiculo_id TEXT NOT NULL, timestamp_gps INTEGER NOT NULL, enviado_en INTEGER NOT NULL, ok INTEGER NOT NULL, error TEXT);',
    );
    db.execSync(
      'CREATE TABLE IF NOT EXISTS latencias (id TEXT PRIMARY KEY NOT NULL, vehiculo_id TEXT NOT NULL, timestamp_emision INTEGER NOT NULL, recibido_en INTEGER NOT NULL, latencia_ms INTEGER NOT NULL);',
    );
    db.execSync(
      'CREATE TABLE IF NOT EXISTS pruebas_eta (id TEXT PRIMARY KEY NOT NULL, parada_id TEXT NOT NULL, vehiculo_id TEXT, inicio INTEGER NOT NULL, eta_predicha_s REAL, llegada INTEGER NOT NULL);',
    );
  }
  return db;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logPing(ping: Omit<PingLog, 'id'>): void {
  try {
    getDb().runSync(
      'INSERT INTO pings (id, vehiculo_id, timestamp_gps, enviado_en, ok, error) VALUES (?, ?, ?, ?, ?, ?)',
      [
        newId(),
        ping.vehiculo_id,
        ping.timestamp_gps,
        ping.enviado_en,
        ping.ok ? 1 : 0,
        ping.error,
      ],
    );
  } catch (error) {
    console.warn('[field-log] no se pudo guardar el ping', error);
  }
}

export function logLatency(latency: Omit<LatencyLog, 'id'>): void {
  try {
    getDb().runSync(
      'INSERT INTO latencias (id, vehiculo_id, timestamp_emision, recibido_en, latencia_ms) VALUES (?, ?, ?, ?, ?)',
      [
        newId(),
        latency.vehiculo_id,
        latency.timestamp_emision,
        latency.recibido_en,
        latency.latencia_ms,
      ],
    );
  } catch (error) {
    console.warn('[field-log] no se pudo guardar la latencia', error);
  }
}

export function logEtaTrial(trial: Omit<EtaTrialLog, 'id'>): void {
  try {
    getDb().runSync(
      'INSERT INTO pruebas_eta (id, parada_id, vehiculo_id, inicio, eta_predicha_s, llegada) VALUES (?, ?, ?, ?, ?, ?)',
      [
        newId(),
        trial.parada_id,
        trial.vehiculo_id,
        trial.inicio,
        trial.eta_predicha_s,
        trial.llegada,
      ],
    );
  } catch (error) {
    console.warn('[field-log] no se pudo guardar la prueba de ETA', error);
  }
}

export function listPings(): PingLog[] {
  return getDb()
    .getAllSync<PingRow>('SELECT * FROM pings ORDER BY timestamp_gps ASC')
    .map((row) => ({
      id: row.id,
      vehiculo_id: row.vehiculo_id,
      timestamp_gps: row.timestamp_gps,
      enviado_en: row.enviado_en,
      ok: row.ok === 1,
      error: row.error ?? null,
    }));
}

export function listLatencies(): LatencyLog[] {
  return getDb()
    .getAllSync<LatencyRow>('SELECT * FROM latencias ORDER BY timestamp_emision ASC')
    .map((row) => ({
      id: row.id,
      vehiculo_id: row.vehiculo_id,
      timestamp_emision: row.timestamp_emision,
      recibido_en: row.recibido_en,
      latencia_ms: row.latencia_ms,
    }));
}

export function listEtaTrials(): EtaTrialLog[] {
  return getDb()
    .getAllSync<EtaTrialRow>('SELECT * FROM pruebas_eta ORDER BY inicio ASC')
    .map((row) => ({
      id: row.id,
      parada_id: row.parada_id,
      vehiculo_id: row.vehiculo_id ?? null,
      inicio: row.inicio,
      eta_predicha_s: row.eta_predicha_s ?? null,
      llegada: row.llegada,
    }));
}

export function clearFieldLogs(): void {
  const database = getDb();
  database.execSync('DELETE FROM pings;');
  database.execSync('DELETE FROM latencias;');
  database.execSync('DELETE FROM pruebas_eta;');
}

export async function exportFieldLogCsv(
  kind: 'pings' | 'latencias' | 'pruebas_eta',
): Promise<string | null> {
  if (kind === 'pings') {
    const rows = listPings();
    if (!rows.length) {
      return null;
    }
    const csv = toCsv(
      [
        'id',
        'vehiculo_id',
        'timestamp_gps_iso',
        'enviado_en_iso',
        'ok',
        'error',
      ],
      rows.map((row) => [
        row.id,
        row.vehiculo_id,
        new Date(row.timestamp_gps).toISOString(),
        new Date(row.enviado_en).toISOString(),
        row.ok,
        row.error,
      ]),
    );
    return exportCsvFile(csv, 'metricas-pings', 'Exportar pings');
  }

  if (kind === 'latencias') {
    const rows = listLatencies();
    if (!rows.length) {
      return null;
    }
    const csv = toCsv(
      [
        'id',
        'vehiculo_id',
        'timestamp_emision_iso',
        'recibido_en_iso',
        'latencia_ms',
      ],
      rows.map((row) => [
        row.id,
        row.vehiculo_id,
        new Date(row.timestamp_emision).toISOString(),
        new Date(row.recibido_en).toISOString(),
        row.latencia_ms,
      ]),
    );
    return exportCsvFile(csv, 'metricas-latencias', 'Exportar latencias');
  }

  const rows = listEtaTrials();
  if (!rows.length) {
    return null;
  }
  const csv = toCsv(
    [
      'id',
      'parada_id',
      'vehiculo_id',
      'inicio_iso',
      'llegada_iso',
      'eta_predicha_s',
    ],
    rows.map((row) => [
      row.id,
      row.parada_id,
      row.vehiculo_id,
      new Date(row.inicio).toISOString(),
      new Date(row.llegada).toISOString(),
      row.eta_predicha_s,
    ]),
  );
  return exportCsvFile(csv, 'metricas-pruebas-eta', 'Exportar pruebas ETA');
}
