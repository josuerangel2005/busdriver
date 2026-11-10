import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK_NAME, STORAGE_KEYS } from '@/constants/config';
import { distanceBetweenM } from '@/lib/geo';
import { getRepository } from '@/services/repository';
import type { TrackingSession } from '@/services/tracking';
import type { VehiculoActivo } from '@/types/models';

type LastPing = {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
};

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[location-task]', error.message);
    return;
  }

  const locations = (data as LocationTaskData | undefined)?.locations;
  if (!locations?.length) {
    return;
  }

  const rawSession = await AsyncStorage.getItem(STORAGE_KEYS.trackingSession);
  if (!rawSession) {
    return;
  }
  const session = JSON.parse(rawSession) as TrackingSession;

  const rawLast = await AsyncStorage.getItem(STORAGE_KEYS.lastPing);
  const last = rawLast ? (JSON.parse(rawLast) as LastPing) : null;

  const location = locations[locations.length - 1];
  const { latitude, longitude } = location.coords;
  const timestamp = location.timestamp || Date.now();

  let speed = location.coords.speed ?? 0;
  if (last && timestamp > last.timestamp) {
    const deltaSeconds = (timestamp - last.timestamp) / 1000;
    const measured =
      distanceBetweenM(
        { latitude: last.lat, longitude: last.lng },
        { latitude, longitude },
      ) / deltaSeconds;
    speed = last.speed > 0 ? last.speed * 0.6 + measured * 0.4 : measured;
  }
  if (!Number.isFinite(speed) || speed < 0) {
    speed = 0;
  }

  const vehiculo: VehiculoActivo = {
    vehiculo_id: session.vehiculoId,
    lat: latitude,
    lng: longitude,
    timestamp_ultima_actualizacion: timestamp,
    ruta_activa: session.rutaId,
    velocidad_actual: speed,
    en_servicio: true,
  };

  await getRepository().publishVehicle(vehiculo);
  await AsyncStorage.setItem(
    STORAGE_KEYS.lastPing,
    JSON.stringify({ lat: latitude, lng: longitude, timestamp, speed }),
  );
});
