import { expect, it } from 'vitest';

import firebaseSeed from '../firebase/seed.json';

import { findRoute } from '@/data/seed';

const directRoute = findRoute('directo-cucuta-ida')!;

it('uses the same direction record in the demo and Firebase seeds', () => {
  expect(directRoute.linea_nombre).toBe('Directo Cúcuta');
  expect(directRoute).toEqual({ id: directRoute.id, ...firebaseSeed.rutas['directo-cucuta-ida'] });
});

it('contains the six direction ids in Firebase and accepts string route ids', async () => {
  const { default: rules } = await import('../firebase/database.rules.json');
  expect(Object.keys(firebaseSeed.rutas).sort()).toEqual([
    'campo-verde-ida', 'campo-verde-vuelta', 'directo-cucuta-ida',
    'directo-cucuta-vuelta', 'natura-ida', 'natura-vuelta',
  ]);
  expect(rules.rules.vehiculos_activos.$vehiculoId.ruta_activa['.validate']).toBe('newData.isString()');
});
