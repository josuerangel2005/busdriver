import {
  FALLBACK_SPEED_MPS,
  MIN_USABLE_SPEED_MPS,
  STALE_THRESHOLD_MS,
} from '@/constants/config';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

import { snapToRoute } from './geo';

export type StopEta = {
  parada: Parada;
  vehiculoId: string | null;
  distanciaRestanteM: number;
  etaSegundos: number | null;
  pasada: boolean;
  desactualizado: boolean;
};

export function effectiveSpeedMps(speed: number): number {
  return speed > MIN_USABLE_SPEED_MPS ? speed : FALLBACK_SPEED_MPS;
}

export function estimateEtaSeconds(
  distanceRemainingM: number,
  speedMps: number,
): number | null {
  if (!Number.isFinite(distanceRemainingM) || distanceRemainingM < 0) {
    return null;
  }
  const speed = effectiveSpeedMps(speedMps);
  if (!Number.isFinite(speed) || speed <= 0) {
    return null;
  }
  return distanceRemainingM / speed;
}

export function isStale(timestampMs: number, now = Date.now()): boolean {
  return now - timestampMs > STALE_THRESHOLD_MS;
}

export function computeStopEtas(
  ruta: Ruta,
  paradas: Parada[],
  vehiculo: VehiculoActivo,
  now = Date.now(),
): StopEta[] {
  if (vehiculo.ruta_activa !== ruta.id) return [];

  const vehicleSnap = snapToRoute(ruta, {
    latitude: vehiculo.lat,
    longitude: vehiculo.lng,
  });
  const stale = isStale(vehiculo.timestamp_ultima_actualizacion, now);

  return [...paradas]
    .sort((a, b) => a.orden - b.orden)
    .map((parada) => {
      const stopSnap = snapToRoute(ruta, { latitude: parada.lat, longitude: parada.lng });
      const deltaKm = stopSnap.alongKm - vehicleSnap.alongKm;
      const distanciaRestanteM = Math.max(0, deltaKm * 1000);
      const pasada = deltaKm < -0.02;
      const etaSegundos = stale
        ? null
        : estimateEtaSeconds(distanciaRestanteM, vehiculo.velocidad_actual);

      return {
        parada,
        vehiculoId: vehiculo.vehiculo_id,
        distanciaRestanteM,
        etaSegundos,
        pasada,
        desactualizado: stale,
      };
    });
}

export function vehiclesForRoute(vehicles: VehiculoActivo[], routeId: string): VehiculoActivo[] {
  return vehicles.filter((vehicle) => vehicle.en_servicio && vehicle.ruta_activa === routeId);
}

export function computeBestStopEtas(
  ruta: Ruta,
  paradas: Parada[],
  vehiculos: VehiculoActivo[],
  now = Date.now(),
): StopEta[] {
  const candidates = vehiclesForRoute(vehiculos, ruta.id);
  if (candidates.length === 0) {
    return [];
  }

  const etasPorVehiculo = candidates.map((vehiculo) =>
    computeStopEtas(ruta, paradas, vehiculo, now),
  );

  return [...paradas]
    .sort((a, b) => a.orden - b.orden)
    .map((parada) => {
      const resultados = etasPorVehiculo
        .map((etas) => etas.find((eta) => eta.parada.id === parada.id))
        .filter((eta): eta is StopEta => eta != null);

      const disponibles = resultados.filter((eta) => !eta.desactualizado && !eta.pasada);
      if (disponibles.length > 0) {
        return disponibles.reduce((best, eta) =>
          eta.distanciaRestanteM < best.distanciaRestanteM ? eta : best,
        );
      }

      const desactualizados = resultados.filter(
        (eta) => eta.desactualizado && !eta.pasada,
      );
      if (desactualizados.length > 0) {
        return desactualizados.reduce((best, eta) =>
          eta.distanciaRestanteM < best.distanciaRestanteM ? eta : best,
        );
      }

      const pasada = resultados.find((eta) => eta.pasada);
      if (pasada) {
        return {
          ...pasada,
          distanciaRestanteM: 0,
          etaSegundos: null,
          desactualizado: resultados.every((eta) => eta.desactualizado),
        };
      }

      return null;
    })
    .filter((eta): eta is StopEta => eta != null);
}

export function formatEta(seconds: number | null): string {
  if (seconds == null) {
    return '—';
  }
  const minutes = seconds / 60;
  if (minutes < 1) {
    return 'menos de 1 min';
  }
  return `${Math.round(minutes)} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
