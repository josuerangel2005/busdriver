import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { LOCATION_TASK_NAME, STORAGE_KEYS, UPDATE_INTERVAL_MS } from '@/constants/config';

import { colors } from '@/constants/theme';

export type TrackingSession = {
  vehiculoId: string;
  rutaId: string;
};

let pendingTrackingWrite: Promise<unknown> = Promise.resolve();

// Serialize session changes with location publications in the tracking runtime.
export function withTrackingWrite<T>(write: () => Promise<T>): Promise<T> {
  const next = pendingTrackingWrite.then(write);
  pendingTrackingWrite = next.catch(() => undefined);
  return next;
}

export function updateTrackingDirection(
  previous: TrackingSession,
  next: TrackingSession,
  publish: () => Promise<void>,
): Promise<void> {
  return withTrackingWrite(async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.trackingSession, JSON.stringify(next));
    try {
      await publish();
    } catch (error) {
      await AsyncStorage.setItem(STORAGE_KEYS.trackingSession, JSON.stringify(previous));
      throw error;
    }
  });
}

export async function getTrackingSession(): Promise<TrackingSession | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.trackingSession);
  return raw ? (JSON.parse(raw) as TrackingSession) : null;
}

export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { foreground: false, background: false };
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: true,
    background: background.status === 'granted',
  };
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function startTracking(session: TrackingSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.trackingSession, JSON.stringify(session));
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: UPDATE_INTERVAL_MS,
    distanceInterval: 0,
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'Rastreo en curso',
      notificationBody: 'Tu ubicación se comparte con los pasajeros.',
      notificationColor: colors.signBlue,
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.trackingSession,
    STORAGE_KEYS.lastPing,
  ]);
}
