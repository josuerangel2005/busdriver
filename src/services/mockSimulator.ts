import { along } from '@turf/along';

import { PLACEHOLDER_ROUTE } from '@/data/seed';
import { routeLengthKm, toLineString } from '@/lib/geo';
import type { Ruta } from '@/types/models';

export type SimVehicle = {
  vehiculo_id: string;
  progressKm: number;
  speedMps: number;
  signalLossEveryMs?: number;
  signalLossDurationMs?: number;
};

export function advanceVehicle(
  ruta: Ruta,
  vehicle: SimVehicle,
  dtMs: number,
): SimVehicle {
  const totalKm = routeLengthKm(ruta);
  // speed (m/s) * dt (ms) / 1_000_000 = distance in kilometers.
  const nextKm = vehicle.progressKm + (vehicle.speedMps * dtMs) / 1_000_000;

  return {
    ...vehicle,
    progressKm: totalKm > 0 && nextKm > totalKm ? 0 : nextKm,
  };
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

const DEMO_ROUTE_LENGTH_KM = routeLengthKm(PLACEHOLDER_ROUTE);

// Three demo buses on the pilot route. Only the third one loses signal so the
// "desactualizado" state becomes visible for longer than STALE_THRESHOLD_MS.
export const DEMO_VEHICLES: SimVehicle[] = [
  {
    vehiculo_id: 'demo-buseta-1',
    progressKm: 0,
    speedMps: 6,
  },
  {
    vehiculo_id: 'demo-buseta-2',
    progressKm: DEMO_ROUTE_LENGTH_KM * 0.35,
    speedMps: 7,
  },
  {
    vehiculo_id: 'demo-buseta-3',
    progressKm: DEMO_ROUTE_LENGTH_KM * 0.7,
    speedMps: 8,
    signalLossEveryMs: 180_000,
    signalLossDurationMs: 45_000,
  },
];
