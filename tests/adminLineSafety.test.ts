import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildLineUpdate, lineIdFor, lineActiveUpdate, routeOnStreets, type LineDraft } from '@/lib/adminLine';
import { bundledCatalog, stopsFor } from '@/lib/routeCatalog';
import rules from '../firebase/database.rules.json';

afterEach(() => vi.useRealTimers());

const P = [{ latitude: 7.9, longitude: -72.5 }, { latitude: 7.91, longitude: -72.51 }, { latitude: 7.92, longitude: -72.52 }];
const stop = (i: number, extra = {}) => ({ point: P[i], alongKm: i, name: `S${i}`, ...extra });

describe('S4 data safety', () => {
  it('edit of natura never touches natura-2 or other lines', () => {
    const prev = [
      ...stopsFor(bundledCatalog, 'natura-ida'), ...stopsFor(bundledCatalog, 'natura-vuelta'),
    ];
    const other = [{ id: 'natura-2-ida-p1', ruta_id: 'natura-2-ida', nombre: 'x', lat: 1, lng: 1, orden: 1 }];
    const draft: LineDraft = { lineId: 'natura', name: 'Natura', active: true, polyline: P, stops: [stop(0), stop(1), stop(2)] };
    const u = buildLineUpdate(draft, [...prev, ...other]);
    const keys = Object.keys(u);
    expect(keys.filter((k) => k.includes('natura-2'))).toEqual([]);
    for (const [k, v] of Object.entries(u)) {
      if (k.startsWith('rutas/')) expect(['rutas/natura-ida', 'rutas/natura-vuelta']).toContain(k);
      else if (v && 'ruta_id' in v) expect(v.ruta_id).toMatch(/^natura-(ida|vuelta)$/);
    }
    const nulls = Object.entries(u).filter(([, value]) => value === null).map(([key]) => key.slice(8));
    for (const id of nulls) expect(prev.find((s) => s.id === id)).toBeTruthy();
  });
  it('payload keys match rule field sets', () => {
    const u = buildLineUpdate({ lineId: 'n', name: 'N', active: false, polyline: P, waypoints: P, stops: [stop(0), stop(2)] }, []);
    const ruleFields = (rule: object) => Object.keys(rule).filter((key) => !/^[.$]/.test(key)).sort();
    const routeFields = ruleFields(rules.rules.rutas.$rutaId);
    const stopFields = ruleFields(rules.rules.paradas.$paradaId);
    for (const record of Object.values(u)) {
      expect(record).not.toBeNull();
      if (!record || typeof record !== 'object') throw new Error('Expected a catalog record');
      const fields = Object.keys(record).sort();
      if ('polyline' in record) {
        for (const field of fields) expect(routeFields).toContain(field);
        for (const point of [...record.polyline, ...(record.waypoints ?? [])]) {
          expect(Object.keys(point).sort()).toEqual(['latitude', 'longitude']);
        }
        expect(record.nombre.length).toBeLessThanOrEqual(120);
      } else {
        expect(fields).toEqual(stopFields);
      }
    }
    expect(u['rutas/n-vuelta']).not.toHaveProperty('waypoints');
    expect(u['rutas/n-vuelta']!.activa).toBe(false);
  });
  it('long names stay within 120', () => {
    const long = 'L'.repeat(80); const nm = 'Ñ'.repeat(80);
    const u = buildLineUpdate({ lineId: 'x', name: long, active: true, polyline: P, stops: [{ ...stop(0), name: nm }, { ...stop(2), name: nm }] }, []);
    expect(u['rutas/x-ida']!.nombre.length).toBeLessThanOrEqual(120);
    expect(u['rutas/x-vuelta']!.nombre.length).toBeLessThanOrEqual(120);
  });
  it('lineIdFor slug/unique', () => {
    expect(lineIdFor('Natura', ['natura'])).toBe('natura-2');
    expect(lineIdFor('Nueva', [])).toBe('nueva-2');
    expect(lineIdFor('!!!', [])).toBe('linea');
    expect(lineIdFor('Ciudad Jardín / Ñ', [])).toMatch(/^[a-z0-9-]+$/);
    expect(lineIdFor('a/b.c#$[]', [])).toBe('a-b-c');
  });
  it('deactivation flips only activa', () => {
    expect(lineActiveUpdate('natura', false)).toEqual({ 'rutas/natura-ida/activa': false, 'rutas/natura-vuelta/activa': false });
  });
});

describe('S4 OSRM', () => {
  it('times out at 10s and falls back', async () => {
    vi.useFakeTimers();
    let sig: AbortSignal | undefined;
    const f = vi.fn<typeof fetch>((_url, init) => {
      sig = init?.signal ?? undefined;
      return new Promise(() => {});
    });
    const p = routeOnStreets(P, f);
    await vi.advanceTimersByTimeAsync(10_001);
    const r = await p;
    expect(r.adjusted).toBe(false); expect(sig?.aborted).toBe(true);
  });
  it('errors and malformed fall back; only coords sent', async () => {
    const fetchers = [];
    for (const f of [
      async () => { throw new Error('net'); },
      async () => ({ ok: false, json: async () => ({}) }),
      async () => ({ ok: true, json: async () => { throw new Error('bad'); } }),
      async () => ({ ok: true, json: async () => ({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[1, 2], ['a', 3]] } }] }) }),
      async () => ({ ok: true, json: async () => ({ code: 'NoRoute' }) }),
    ]) {
      const fetcher = vi.fn<typeof fetch>(async () => await f() as Response);
      fetchers.push(fetcher);
      const r = await routeOnStreets(P, fetcher);
      expect(r).toEqual({ polyline: P, adjusted: false });
    }
    const [url, init] = fetchers[0].mock.calls[0];
    expect(url).toBe('https://router.project-osrm.org/route/v1/driving/-72.5,7.9;-72.51,7.91;-72.52,7.92?overview=full&geometries=geojson');
    expect(Object.keys(init ?? {})).toEqual(['signal']);
  });
});

it('falls back when the fetch rejects in response to the timeout abort', async () => {
  vi.useFakeTimers();
  const points = [{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }];
  const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')), { once: true });
  }));
  const pending = routeOnStreets(points, fetcher);
  await vi.advanceTimersByTimeAsync(10_001);
  await expect(pending).resolves.toEqual({ polyline: points, adjusted: false });
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
