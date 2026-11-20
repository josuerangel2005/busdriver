import type { VehiculoActivo } from '@/types/models';

import type { TrackingSession } from './tracking';

export type ShiftPosition = {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number | null;
};

export type BeginShiftDeps = {
  getCurrentPosition: () => Promise<ShiftPosition>;
  publishVehicle: (vehiculo: VehiculoActivo) => Promise<void>;
  startTracking: (session: TrackingSession) => Promise<void>;
};

export type EndShiftDeps = {
  stopTracking: () => Promise<void>;
  setService: (vehiculoId: string, enServicio: boolean) => Promise<void>;
};

function normalizeSpeed(speed: number | null): number {
  if (speed === null || !Number.isFinite(speed) || speed < 0) {
    return 0;
  }
  return speed;
}

export async function beginShift(
  deps: BeginShiftDeps,
  session: TrackingSession,
): Promise<VehiculoActivo> {
  const position = await deps.getCurrentPosition();
  const vehiculo: VehiculoActivo = {
    vehiculo_id: session.vehiculoId,
    lat: position.lat,
    lng: position.lng,
    timestamp_ultima_actualizacion: position.timestamp,
    ruta_activa: session.rutaId,
    velocidad_actual: normalizeSpeed(position.speed),
    en_servicio: true,
  };

  await deps.publishVehicle(vehiculo);
  await deps.startTracking(session);

  return vehiculo;
}

export async function endShift(
  deps: EndShiftDeps,
  vehiculoId: string,
): Promise<void> {
  await deps.stopTracking();
  await deps.setService(vehiculoId, false);
}
