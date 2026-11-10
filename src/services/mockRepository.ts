import along from '@turf/along';

import { PILOT_ROUTE_ID } from '@/constants/config';
import { PLACEHOLDER_PARADAS, PLACEHOLDER_ROUTE } from '@/data/seed';
import { toLineString } from '@/lib/geo';
import type {
  Consentimiento,
  MetricaEspera,
  Parada,
  Ruta,
  VehiculoActivo,
} from '@/types/models';

import type { Repository, Unsubscribe } from './repository';

const MOCK_VEHICLE_ID = 'vehiculo-demo';
const SIMULATOR_TICK_MS = 3_000;
const SIMULATOR_STEP_KM = 0.02;

type Listener<T> = (value: T) => void;

const vehicles = new Map<string, VehiculoActivo>();
const consents = new Map<string, Consentimiento>();
const metrics = new Map<string, MetricaEspera>();
const vehicleListeners = new Set<Listener<VehiculoActivo[]>>();

let simulator: ReturnType<typeof setInterval> | null = null;
const simulatorProgress = new Map<string, number>();

function emitVehicles() {
  const snapshot = [...vehicles.values()];
  vehicleListeners.forEach((listener) => listener(snapshot));
}

function startSimulator() {
  if (simulator) {
    return;
  }
  const line = toLineString(PLACEHOLDER_ROUTE);
  const totalKm = 4.5;
  simulator = setInterval(() => {
    let changed = false;
    for (const [id, current] of vehicles) {
      if (!current.en_servicio) {
        continue;
      }
      let alongKm = (simulatorProgress.get(id) ?? 0) + SIMULATOR_STEP_KM;
      if (alongKm > totalKm) {
        alongKm = 0;
      }
      simulatorProgress.set(id, alongKm);
      const [lng, lat] = along(line, alongKm, { units: 'kilometers' })
        .geometry.coordinates;
      vehicles.set(id, {
        ...current,
        lat,
        lng,
        timestamp_ultima_actualizacion: Date.now(),
        velocidad_actual: (SIMULATOR_STEP_KM * 1000) / (SIMULATOR_TICK_MS / 1000),
      });
      changed = true;
    }
    if (changed) {
      emitVehicles();
    }
  }, SIMULATOR_TICK_MS);
}

function stopSimulator() {
  if (simulator) {
    clearInterval(simulator);
    simulator = null;
  }
}

export const mockRepository: Repository = {
  subscribeVehicles(onData, onError): Unsubscribe {
    vehicleListeners.add(onData);
    if (vehicles.size === 0) {
      vehicles.set(MOCK_VEHICLE_ID, {
        vehiculo_id: MOCK_VEHICLE_ID,
        lat: PLACEHOLDER_ROUTE.polyline[0].latitude,
        lng: PLACEHOLDER_ROUTE.polyline[0].longitude,
        timestamp_ultima_actualizacion: Date.now(),
        ruta_activa: PILOT_ROUTE_ID,
        velocidad_actual: 0,
        en_servicio: false,
      });
    }
    try {
      onData([...vehicles.values()]);
    } catch (error) {
      onError?.(error as Error);
    }
    return () => {
      vehicleListeners.delete(onData);
    };
  },

  subscribeRoute(routeId, onData): Unsubscribe {
    onData(routeId === PILOT_ROUTE_ID ? PLACEHOLDER_ROUTE : null);
    return () => undefined;
  },

  subscribeStops(routeId, onData): Unsubscribe {
    onData(PLACEHOLDER_PARADAS.filter((parada) => parada.ruta_id === routeId));
    return () => undefined;
  },

  async publishVehicle(vehiculo): Promise<void> {
    vehicles.set(vehiculo.vehiculo_id, vehiculo);
    emitVehicles();
  },

  async setService(vehiculoId, enServicio): Promise<void> {
    const current = vehicles.get(vehiculoId);
    const base: VehiculoActivo = current ?? {
      vehiculo_id: vehiculoId,
      lat: PLACEHOLDER_ROUTE.polyline[0].latitude,
      lng: PLACEHOLDER_ROUTE.polyline[0].longitude,
      timestamp_ultima_actualizacion: Date.now(),
      ruta_activa: PILOT_ROUTE_ID,
      velocidad_actual: 0,
      en_servicio: enServicio,
    };
    vehicles.set(vehiculoId, {
      ...base,
      en_servicio: enServicio,
      timestamp_ultima_actualizacion: Date.now(),
    });
    if (enServicio) {
      startSimulator();
    } else {
      stopSimulator();
    }
    emitVehicles();
  },

  async saveConsent(uid, consentimiento): Promise<void> {
    consents.set(uid, consentimiento);
  },

  async getConsent(uid): Promise<Consentimiento | null> {
    return consents.get(uid) ?? null;
  },

  async saveMetric(metrica): Promise<void> {
    metrics.set(metrica.id, metrica);
  },
};

export type MockState = {
  vehicles: Map<string, VehiculoActivo>;
  consents: Map<string, Consentimiento>;
  metrics: Map<string, MetricaEspera>;
  paradas: Parada[];
  ruta: Ruta;
};
