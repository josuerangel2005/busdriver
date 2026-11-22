import distance from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { Feature, LineString } from 'geojson';

import type { LatLng, Ruta } from '@/types/models';

const KM_TO_M = 1000;

export function toLineString(ruta: Pick<Ruta, 'polyline'>): Feature<LineString> {
  return lineString(ruta.polyline.map((p) => [p.longitude, p.latitude]));
}

export function routeLengthKm(ruta: Ruta): number {
  return length(toLineString(ruta), { units: 'kilometers' });
}

export type Snap = {
  alongKm: number;
  distanceToRouteKm: number;
  location: LatLng;
};

export function snapToRoute(ruta: Pick<Ruta, 'polyline'>, position: LatLng): Snap {
  const line = toLineString(ruta);
  const snapped = nearestPointOnLine(
    line,
    point([position.longitude, position.latitude]),
    { units: 'kilometers' },
  );
  const [lng, lat] = snapped.geometry.coordinates;
  return {
    alongKm: snapped.properties.location ?? 0,
    distanceToRouteKm: snapped.properties.dist ?? 0,
    location: { latitude: lat, longitude: lng },
  };
}

export function distanceBetweenM(a: LatLng, b: LatLng): number {
  const km = distance(point([a.longitude, a.latitude]), point([b.longitude, b.latitude]), {
    units: 'kilometers',
  });
  return km * KM_TO_M;
}

export function getRouteBounds(polyline: LatLng[]): [number, number, number, number] | undefined {
  if (polyline.length < 2) return undefined;

  const { latitude, longitude } = polyline[0];
  const bounds: [number, number, number, number] = [longitude, latitude, longitude, latitude];
  for (const point of polyline) {
    bounds[0] = Math.min(bounds[0], point.longitude);
    bounds[1] = Math.min(bounds[1], point.latitude);
    bounds[2] = Math.max(bounds[2], point.longitude);
    bounds[3] = Math.max(bounds[3], point.latitude);
  }
  return bounds;
}
