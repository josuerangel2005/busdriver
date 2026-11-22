import { USE_MOCK } from '@/constants/config';
import type {
  Consentimiento,
  MetricaEspera,
  Parada,
  Ruta,
  VehiculoActivo,
} from '@/types/models';

export type Unsubscribe = () => void;

export type Repository = {
  subscribeVehicles(
    onData: (vehiculos: VehiculoActivo[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeRoutes(onData: (rutas: Ruta[]) => void): Unsubscribe;
  subscribeRoute(routeId: string, onData: (ruta: Ruta | null) => void): Unsubscribe;
  subscribeStops(routeId: string, onData: (paradas: Parada[]) => void): Unsubscribe;
  publishVehicle(vehiculo: VehiculoActivo): Promise<void>;
  setVehicleRoute(vehiculoId: string, routeId: string): Promise<void>;
  setService(vehiculoId: string, enServicio: boolean): Promise<void>;
  saveConsent(uid: string, consentimiento: Consentimiento): Promise<void>;
  getConsent(uid: string): Promise<Consentimiento | null>;
  saveMetric(metrica: MetricaEspera): Promise<void>;
};

export function getRepository(): Repository {
  if (USE_MOCK) {
    return (require('./mockRepository') as typeof import('./mockRepository'))
      .mockRepository;
  }
  return (require('./firebaseRepository') as typeof import('./firebaseRepository'))
    .firebaseRepository;
}
