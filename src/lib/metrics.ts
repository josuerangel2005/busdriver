import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import type { MetricaEspera } from '@/types/models';

type EsperaRow = {
  id: string;
  parada_id: string;
  inicio: number;
  fin: number;
  duracion_ms: number;
};

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('metricas.db');
    db.execSync(
      'CREATE TABLE IF NOT EXISTS esperas (id TEXT PRIMARY KEY NOT NULL, parada_id TEXT NOT NULL, inicio INTEGER NOT NULL, fin INTEGER NOT NULL, duracion_ms INTEGER NOT NULL);',
    );
  }
  return db;
}

export function startWait(paradaId: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  getDb().runSync(
    'INSERT INTO esperas (id, parada_id, inicio, fin, duracion_ms) VALUES (?, ?, ?, ?, ?)',
    [id, paradaId, Date.now(), 0, 0],
  );
  return id;
}

export function finishWait(id: string): MetricaEspera | null {
  const rows = getDb().getAllSync<EsperaRow>(
    'SELECT * FROM esperas WHERE id = ?',
    [id],
  );
  if (!rows.length) {
    return null;
  }
  const fin = Date.now();
  const duracion = fin - rows[0].inicio;
  getDb().runSync('UPDATE esperas SET fin = ?, duracion_ms = ? WHERE id = ?', [
    fin,
    duracion,
    id,
  ]);
  return {
    id,
    parada_id: rows[0].parada_id,
    inicio: rows[0].inicio,
    fin,
    duracion_ms: duracion,
  };
}

export function listWaits(): MetricaEspera[] {
  return getDb()
    .getAllSync<EsperaRow>('SELECT * FROM esperas WHERE fin > 0 ORDER BY inicio ASC')
    .map((row) => ({
      id: row.id,
      parada_id: row.parada_id,
      inicio: row.inicio,
      fin: row.fin,
      duracion_ms: row.duracion_ms,
    }));
}

export async function exportWaitsCsv(): Promise<string | null> {
  const rows = listWaits();
  if (!rows.length) {
    return null;
  }

  const header = 'id,parada_id,inicio_iso,fin_iso,duracion_ms';
  const body = rows
    .map((row) =>
      [
        row.id,
        row.parada_id,
        new Date(row.inicio).toISOString(),
        new Date(row.fin).toISOString(),
        row.duracion_ms,
      ].join(','),
    )
    .join('\n');

  const file = new File(Paths.cache, `metricas-espera-${Date.now()}.csv`);
  file.create({ overwrite: true, intermediates: true });
  file.write(`${header}\n${body}`);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar métricas de espera',
    });
  }

  return file.uri;
}
