import {
  get,
  getDatabase,
  onValue,
  ref,
  set,
  update,
} from '@react-native-firebase/database';
import type { DataSnapshot } from '@react-native-firebase/database';

import type {
  Consentimiento,
  MetricaEspera,
  Parada,
  Ruta,
  VehiculoActivo,
} from '@/types/models';

import type { Repository, Unsubscribe } from './repository';

function toList<T extends object>(value: Record<string, T> | null): T[] {
  if (!value) {
    return [];
  }
  return Object.entries(value).map(([key, item]) => ({ id: key, ...item }));
}

function toRuta(id: string, value: Omit<Ruta, 'id'> | null): Ruta | null {
  if (!value) {
    return null;
  }
  return { id, ...value };
}

function db() {
  return getDatabase();
}

export const firebaseRepository: Repository = {
  subscribeVehicles(onData, onError): Unsubscribe {
    return onValue(
      ref(db(), 'vehiculos_activos'),
      (snapshot: DataSnapshot) => {
        onData(toList<VehiculoActivo>(snapshot.val()));
      },
      (error: Error) => onError?.(error),
    );
  },

  subscribeRoute(routeId, onData): Unsubscribe {
    return onValue(ref(db(), `rutas/${routeId}`), (snapshot: DataSnapshot) => {
      onData(toRuta(routeId, snapshot.val()));
    });
  },

  subscribeStops(routeId, onData): Unsubscribe {
    return onValue(ref(db(), 'paradas'), (snapshot: DataSnapshot) => {
      const paradas = toList<Parada>(snapshot.val()).filter(
        (parada) => parada.ruta_id === routeId,
      );
      onData(paradas);
    });
  },

  async publishVehicle(vehiculo): Promise<void> {
    await set(ref(db(), `vehiculos_activos/${vehiculo.vehiculo_id}`), vehiculo);
  },

  async setService(vehiculoId, enServicio): Promise<void> {
    await update(ref(db(), `vehiculos_activos/${vehiculoId}`), {
      en_servicio: enServicio,
      timestamp_ultima_actualizacion: Date.now(),
    });
  },

  async saveConsent(uid, consentimiento): Promise<void> {
    await set(ref(db(), `usuarios/${uid}/consentimiento`), consentimiento);
  },

  async getConsent(uid): Promise<Consentimiento | null> {
    const snapshot = await get(ref(db(), `usuarios/${uid}/consentimiento`));
    return (snapshot.val() as Consentimiento | null) ?? null;
  },

  async saveMetric(metrica: MetricaEspera): Promise<void> {
    await set(ref(db(), `metricas/${metrica.id}`), metrica);
  },
};
