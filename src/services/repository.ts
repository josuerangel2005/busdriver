import type { LineUpdate } from '@/lib/adminLine';
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
  subscribeConnection(onChange: (online: boolean) => void): Unsubscribe;
  isAdmin(uid: string): Promise<boolean>;
  subscribeVehicles(
    onData: (vehiculos: VehiculoActivo[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  subscribeRoutes(onData: (rutas: Ruta[]) => void): Unsubscribe;
  subscribeAllStops(onData: (paradas: Parada[]) => void): Unsubscribe;
  subscribeRoute(routeId: string, onData: (ruta: Ruta | null) => void): Unsubscribe;
  subscribeStops(routeId: string, onData: (paradas: Parada[]) => void): Unsubscribe;
  saveLine(update: LineUpdate): Promise<void>;
  setLineActive(lineaId: string, active: boolean): Promise<void>;
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
