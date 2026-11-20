export const APP_NAME = 'Rastreo Cúcuta';

export const PILOT_ROUTE_ID = 'ruta-piloto-01';

export const LOCATION_TASK_NAME = 'rastreo-background-location';

export const UPDATE_INTERVAL_MS = 10_000;

export const STALE_THRESHOLD_MS = 30_000;

export const PING_TARGET_MS = 10_000;

export const LATENCY_TARGET_MS = 15_000;

export const ETA_ERROR_TARGET_S = 180;

export const MIN_USABLE_SPEED_MPS = 1;

export const FALLBACK_SPEED_MPS = 5.5;

export const CONSENT_VERSION = '2026-01';

export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

export const STORAGE_KEYS = {
  trackingSession: 'tracking_session',
  lastPing: 'tracking_last_ping',
  uid: 'auth_uid',
  role: 'auth_role',
} as const;
