import { expect, it } from 'vitest';

import firebaseSeed from '../firebase/seed.json';

import { PILOT_ROUTE } from '@/data/seed';

it('uses the same short route name in the demo and Firebase seeds', () => {
  expect(PILOT_ROUTE.nombre).toBe('Directo Cúcuta');
  expect(firebaseSeed.rutas['ruta-piloto-01'].nombre).toBe(PILOT_ROUTE.nombre);
});
