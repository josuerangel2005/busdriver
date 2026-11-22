import { along } from '@turf/along';

import { ROUTES } from '@/data/seed';
import { bundledCatalog, findRoute, oppositeRoute } from '@/lib/routeCatalog';
import { routeLengthKm, toLineString } from '@/lib/geo';
import type { Ruta } from '@/types/models';

export type SimVehicle = {
  vehiculo_id: string;
  rutaId: string;
  progressKm: number;
  speedMps: number;
  signalLossEveryMs?: number;
  signalLossDurationMs?: number;
};

const lengths = new Map(ROUTES.map((route) => [route.id, routeLengthKm(route)]));

export function advanceVehicle(vehicle: SimVehicle, dtMs: number): SimVehicle {
  const route = findRoute(bundledCatalog, vehicle.rutaId);
  const reverse = route && oppositeRoute(bundledCatalog, route);
  if (!route || !reverse) return vehicle;

  const length = lengths.get(route.id)!;
  const reverseLength = lengths.get(reverse.id)!;
  // Preserve leftover distance when passing a shared endpoint.
  const progress = (vehicle.progressKm + (vehicle.speedMps * dtMs) / 1_000_000)
    % (length + reverseLength);
  return progress >= length
    ? { ...vehicle, rutaId: reverse.id, progressKm: progress - length }
    : { ...vehicle, progressKm: progress };
}

export function positionAt(
  ruta: Ruta,
  progressKm: number,
): { lat: number; lng: number } {
  const totalKm = routeLengthKm(ruta);
  const clampedKm = Math.max(0, Math.min(progressKm, totalKm));
  const [lng, lat] = along(toLineString(ruta), clampedKm, {
    units: 'kilometers',
  }).geometry.coordinates;

  return { lat, lng };
}

export function isInSignalLoss(vehicle: SimVehicle, elapsedMs: number): boolean {
  const { signalLossEveryMs, signalLossDurationMs } = vehicle;
  if (!signalLossEveryMs || !signalLossDurationMs) {
    return false;
  }
  const cycleMs = elapsedMs % signalLossEveryMs;
  return cycleMs >= signalLossEveryMs - signalLossDurationMs;
}

const HEADWAY_MINUTES: Record<string, number> = {
  'directo-cucuta': 8,
  'campo-verde': 17,
  natura: 17,
};
export const DEMO_SPEED_MPS = 7;

// Even spacing around the round trip approximates each published headway.
export const DEMO_VEHICLES: SimVehicle[] = ROUTES.filter((route) => route.sentido === 'ida')
  .flatMap((route) => {
    const length = lengths.get(route.id)!;
    const reverse = oppositeRoute(bundledCatalog, route)!;
    const roundTripKm = length + lengths.get(reverse.id)!;
    const headwaySeconds = HEADWAY_MINUTES[route.linea_id] * 60;
    const headwayKm = (headwaySeconds * DEMO_SPEED_MPS) / 1_000;
    const count = Math.max(2, Math.round(roundTripKm / headwayKm));
    const speedMps = (roundTripKm * 1_000) / (count * headwaySeconds);

    return Array.from({ length: count }, (_, index) => {
      const progress = (roundTripKm * index) / count;
      const lossy = route.linea_id === 'directo-cucuta' && index === 2;
      return {
        vehiculo_id: route.linea_id === 'directo-cucuta'
          ? `demo-buseta-${index + 1}`
          : `demo-${route.linea_id}-${index + 1}`,
        rutaId: progress < length ? route.id : reverse.id,
        progressKm: progress < length ? progress : progress - length,
        speedMps,
        ...(lossy ? { signalLossEveryMs: 180_000, signalLossDurationMs: 45_000 } : {}),
      };
    });
  });
