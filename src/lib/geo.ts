import distance from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { Feature, LineString } from 'geojson';

import type { LatLng, Ruta } from '@/types/models';

const KM_TO_M = 1000;

export function toLineString(ruta: Ruta): Feature<LineString> {
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

export function snapToRoute(ruta: Ruta, position: LatLng): Snap {
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
