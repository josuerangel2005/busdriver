import { snapToRoute } from '@/lib/geo';
import type { LatLng, Parada, Ruta } from '@/types/models';

export type DraftStop = {
  point: LatLng;
  alongKm: number;
  name: string;
  idaId?: string;
  vueltaId?: string;
};

export type LineDraft = {
  lineId: string;
  name: string;
  active: boolean;
  returnActive?: boolean;
  polyline: LatLng[];
  waypoints?: LatLng[];
  stops: DraftStop[];
};

export type LineUpdate = Partial<Record<`rutas/${string}`, Omit<Ruta, 'id'>>>
  & Partial<Record<`paradas/${string}`, Omit<Parada, 'id'> | null>>;

export const OSRM_FALLBACK = 'No se pudo ajustar a las calles; se guardará en línea recta.';

export function lineIdFor(name: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  taken.add('nueva');
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'linea';
  let id = base;
  for (let suffix = 2; taken.has(id); suffix++) id = `${base}-${suffix}`;
  return id;
}

export function lineRouteIds(lineId: string) {
  return [`${lineId}-ida`, `${lineId}-vuelta`] as const;
}

export function lineActiveUpdate(lineId: string, active: boolean) {
  return Object.fromEntries(lineRouteIds(lineId).map((id) => [`rutas/${id}/activa`, active]));
}

export function orderStops<T extends { alongKm: number }>(stops: readonly T[]): T[] {
  return [...stops].sort((a, b) => a.alongKm - b.alongKm);
}

export function snapToTrace(polyline: LatLng[], point: LatLng) {
  return snapToRoute({ polyline }, point);
}

export function snapAdminStop(polyline: LatLng[], point: LatLng) {
  if (polyline.length < 2) return null;
  const result = snapToTrace(polyline, point);
  return result.distanceToRouteKm <= 0.15 ? result : null;
}

export function validName(name: string): boolean {
  const length = name.trim().length;
  return length >= 1 && length <= 80;
}

export function validateLine(draft: LineDraft): string | null {
  if (!validName(draft.name)) return 'Nombre de la línea: escribe entre 1 y 80 caracteres.';
  if (draft.polyline.length < 2 || (draft.waypoints && draft.waypoints.length < 2)) {
    return 'Agrega al menos dos puntos de trazado.';
  }
  if (draft.stops.length < 2) return 'Agrega al menos dos paraderos.';
  if (draft.stops.some(({ name }) => !validName(name))) return 'Cada paradero debe tener un nombre de 1 a 80 caracteres.';
  return null;
}

function directionName(line: string, stops: DraftStop[]): string {
  const origin = stops[0]?.name.trim() ?? '';
  const destination = stops.at(-1)?.name.trim() ?? '';
  const endpointLimit = Math.floor((120 - line.length - ' ·  → '.length) / 2);
  const shorten = (name: string) =>
    name.length > endpointLimit ? `${name.slice(0, endpointLimit - 1)}…` : name;
  return `${line} · ${shorten(origin)} → ${shorten(destination)}`;
}

function directionStops(routeId: string, stops: DraftStop[], field: 'idaId' | 'vueltaId', reserved: Iterable<string>): Parada[] {
  const used = new Set(reserved);
  for (const stop of stops) {
    const id = stop[field];
    if (id) used.add(id);
  }
  let number = 1;
  return stops.map((stop, index) => {
    let id = stop[field];
    if (!id) {
      do id = `${routeId}-p${number++}`; while (used.has(id));
      used.add(id);
    }
    return { id, ruta_id: routeId, nombre: stop.name.trim(), lat: stop.point.latitude, lng: stop.point.longitude, orden: index + 1 };
  });
}

export function buildReturnRoute(ida: Ruta, stops: DraftStop[], reserved: Iterable<string> = []) {
  const { waypoints: _waypoints, ...base } = ida;
  const reversed = orderStops(stops).reverse();
  const [, id] = lineRouteIds(ida.linea_id);
  const route: Ruta = {
    ...base,
    id,
    sentido: 'vuelta',
    nombre: directionName(ida.linea_nombre, reversed),
    polyline: [...ida.polyline].reverse(),
  };
  return { route, stops: directionStops(id, reversed, 'vueltaId', reserved) };
}

export function buildLineUpdate(draft: LineDraft, previousStops: Parada[]): LineUpdate {
  const [idaId, vueltaId] = lineRouteIds(draft.lineId);
  const reserved = previousStops.map((stop) => stop.id);
  const ordered = orderStops(draft.stops);
  const name = draft.name.trim();
  const ida: Ruta = {
    id: idaId,
    nombre: directionName(name, ordered),
    linea_id: draft.lineId,
    linea_nombre: name,
    sentido: 'ida',
    activa: draft.active,
    polyline: draft.polyline,
    ...(draft.waypoints ? { waypoints: draft.waypoints } : {}),
  };
  const vuelta = buildReturnRoute(ida, ordered, reserved);
  vuelta.route.activa = draft.returnActive ?? draft.active;
  const update: LineUpdate = {};
  for (const { id, ...route } of [ida, vuelta.route]) update[`rutas/${id}`] = route;
  for (const { id, ruta_id } of previousStops) {
    if (ruta_id === idaId || ruta_id === vueltaId) update[`paradas/${id}`] = null;
  }
  for (const { id, ...stop } of [...directionStops(idaId, ordered, 'idaId', reserved), ...vuelta.stops]) {
    update[`paradas/${id}`] = stop;
  }
  return update;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

export function parseOsrmRoute(value: unknown): LatLng[] | null {
  const payload = object(value);
  if (payload?.code !== 'Ok' || !Array.isArray(payload.routes)) return null;
  const geometry = object(object(payload.routes[0])?.geometry);
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return null;
  const result: LatLng[] = [];
  for (const pair of geometry.coordinates) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [longitude, latitude] = pair;
    if (typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
    result.push({ latitude, longitude });
  }
  return result;
}

export async function routeOnStreets(waypoints: LatLng[], fetcher: typeof fetch = fetch) {
  const fallback = { polyline: [...waypoints], adjusted: false };
  if (waypoints.length < 2) return fallback;
  const controller = new AbortController();
  const coordinates = waypoints.map(({ longitude, latitude }) => `${longitude},${latitude}`).join(';');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        resolve(null);
        controller.abort();
      }, 10_000);
    });
    const request = (async () => {
      const response = await fetcher(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        { signal: controller.signal },
      );
      return response.ok ? parseOsrmRoute(await response.json()) : null;
    })();
    const polyline = await Promise.race([request, timeout]);
    return polyline ? { polyline, adjusted: true } : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
