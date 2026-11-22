import { PILOT_ROUTE_ID } from '@/constants/config';
import { PILOT_PARADAS, PILOT_ROUTE } from '@/data/seed';
import { snapToRoute } from '@/lib/geo';
import type {
  Consentimiento,
  MetricaEspera,
  Parada,
  Ruta,
  VehiculoActivo,
} from '@/types/models';

import {
  advanceVehicle,
  DEMO_VEHICLES,
  isInSignalLoss,
  positionAt,
  type SimVehicle,
} from './mockSimulator';
import type { Repository, Unsubscribe } from './repository';

const SIMULATOR_TICK_MS = 3_000;
const DRIVER_SPEED_MPS = 7;

const DEMO_IDS = new Set(DEMO_VEHICLES.map((vehicle) => vehicle.vehiculo_id));

type Listener<T> = (value: T) => void;

const vehicles = new Map<string, VehiculoActivo>();
const consents = new Map<string, Consentimiento>();
const metrics = new Map<string, MetricaEspera>();
const vehicleListeners = new Set<Listener<VehiculoActivo[]>>();
const simVehicles = new Map<string, SimVehicle>();

let simulator: ReturnType<typeof setInterval> | null = null;
let simulatorStartedAt: number | null = null;
let demoSeeded = false;

function emitVehicles() {
  const snapshot = [...vehicles.values()];
  vehicleListeners.forEach((listener) => listener(snapshot));
}

function isDemoVehicle(vehiculoId: string): boolean {
  return DEMO_IDS.has(vehiculoId);
}

function hasActiveDriverVehicle(): boolean {
  for (const vehiculoId of simVehicles.keys()) {
    if (isDemoVehicle(vehiculoId)) {
      continue;
    }
    if (vehicles.get(vehiculoId)?.en_servicio) {
      return true;
    }
  }
  return false;
}

function syncSimulator() {
  const shouldRun = vehicleListeners.size > 0 || hasActiveDriverVehicle();
  if (shouldRun) {
    startSimulator();
  } else {
    stopSimulator();
  }
}

function tick() {
  const now = Date.now();
  const elapsedMs = simulatorStartedAt == null ? 0 : now - simulatorStartedAt;
  let changed = false;

  for (const [vehiculoId, simVehicle] of simVehicles) {
    const current = vehicles.get(vehiculoId);
    if (!current?.en_servicio) {
      continue;
    }
    if (isInSignalLoss(simVehicle, elapsedMs)) {
      continue;
    }

    const advanced = advanceVehicle(PILOT_ROUTE, simVehicle, SIMULATOR_TICK_MS);
    simVehicles.set(vehiculoId, advanced);

    const position = positionAt(PILOT_ROUTE, advanced.progressKm);
    vehicles.set(vehiculoId, {
      ...current,
      lat: position.lat,
      lng: position.lng,
      timestamp_ultima_actualizacion: now,
      velocidad_actual: advanced.speedMps,
    });
    changed = true;
  }

  if (changed) {
    emitVehicles();
  }
}

function startSimulator() {
  if (simulator) {
    return;
  }
  if (simulatorStartedAt == null) {
    simulatorStartedAt = Date.now();
  }
  simulator = setInterval(tick, SIMULATOR_TICK_MS);
}

function stopSimulator() {
  if (simulator) {
    clearInterval(simulator);
    simulator = null;
  }
}

function seedDemoVehicles() {
  if (demoSeeded) {
    return;
  }
  demoSeeded = true;

  const now = Date.now();
  for (const demo of DEMO_VEHICLES) {
    const simVehicle: SimVehicle = { ...demo };
    simVehicles.set(demo.vehiculo_id, simVehicle);

    const position = positionAt(PILOT_ROUTE, simVehicle.progressKm);
    vehicles.set(demo.vehiculo_id, {
      vehiculo_id: demo.vehiculo_id,
      lat: position.lat,
      lng: position.lng,
      timestamp_ultima_actualizacion: now,
      ruta_activa: PILOT_ROUTE_ID,
      velocidad_actual: demo.speedMps,
      en_servicio: true,
    });
  }
}

function registerDriverVehicle(vehiculo: VehiculoActivo) {
  const snap = snapToRoute(PILOT_ROUTE, {
    latitude: vehiculo.lat,
    longitude: vehiculo.lng,
  });
  simVehicles.set(vehiculo.vehiculo_id, {
    vehiculo_id: vehiculo.vehiculo_id,
    progressKm: snap.alongKm,
    speedMps: DRIVER_SPEED_MPS,
  });
}

export function resetMockState(): void {
  stopSimulator();
  vehicles.clear();
  consents.clear();
  metrics.clear();
  vehicleListeners.clear();
  simVehicles.clear();
  simulatorStartedAt = null;
  demoSeeded = false;
}

export const mockRepository: Repository = {
  subscribeVehicles(onData, onError): Unsubscribe {
    vehicleListeners.add(onData);
    seedDemoVehicles();
    syncSimulator();

    try {
      onData([...vehicles.values()]);
    } catch (error) {
      onError?.(error as Error);
    }

    return () => {
      vehicleListeners.delete(onData);
      syncSimulator();
    };
  },

  subscribeRoute(routeId, onData): Unsubscribe {
    onData(routeId === PILOT_ROUTE_ID ? PILOT_ROUTE : null);
    return () => undefined;
  },

  subscribeStops(routeId, onData): Unsubscribe {
    onData(PILOT_PARADAS.filter((parada) => parada.ruta_id === routeId));
    return () => undefined;
  },

  async publishVehicle(vehiculo): Promise<void> {
    vehicles.set(vehiculo.vehiculo_id, vehiculo);
    if (vehiculo.en_servicio && !isDemoVehicle(vehiculo.vehiculo_id)) {
      registerDriverVehicle(vehiculo);
    }
    syncSimulator();
    emitVehicles();
  },

  async setService(vehiculoId, enServicio): Promise<void> {
    const current = vehicles.get(vehiculoId);
    const base: VehiculoActivo = current ?? {
      vehiculo_id: vehiculoId,
      lat: PILOT_ROUTE.polyline[0].latitude,
      lng: PILOT_ROUTE.polyline[0].longitude,
      timestamp_ultima_actualizacion: Date.now(),
      ruta_activa: PILOT_ROUTE_ID,
      velocidad_actual: 0,
      en_servicio: enServicio,
    };
    const updated: VehiculoActivo = {
      ...base,
      en_servicio: enServicio,
      timestamp_ultima_actualizacion: Date.now(),
    };
    vehicles.set(vehiculoId, updated);

    if (enServicio && !isDemoVehicle(vehiculoId) && !simVehicles.has(vehiculoId)) {
      registerDriverVehicle(updated);
    }

    syncSimulator();
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
