import type { Parada, Ruta, Sentido } from '@/types/models';

import seed from '../../firebase/seed.json';

// Use the same catalog in the demo and in the Firebase import.
// Load each direction as stored; Claret has a distinct return alignment and stops.
export const ROUTES: Ruta[] = Object.entries(seed.rutas).map(([id, route]) => ({
  id,
  ...route,
  sentido: route.sentido as Sentido,
}));

export const PARADAS: Parada[] = Object.entries(seed.paradas).map(([id, stop]) => ({
  id,
  ...stop,
}));
