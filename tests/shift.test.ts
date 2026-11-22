import { describe, expect, it } from 'vitest';

import { beginShift, endShift } from '@/services/shift';
import type { VehiculoActivo } from '@/types/models';

const session = { vehiculoId: 'uid-1', rutaId: 'campo-verde-vuelta' };

const position = {
  lat: 7.8939,
  lng: -72.5078,
  timestamp: 1_700_000_000_000,
  speed: 12.5,
};

describe('beginShift', () => {
  it('reads the position, publishes the complete vehicle and then starts tracking', async () => {
    const calls: string[] = [];
    const published: VehiculoActivo[] = [];

    const resultado = await beginShift(
      {
        getCurrentPosition: async () => {
          calls.push('getCurrentPosition');
          return position;
        },
        publishVehicle: async (vehiculo) => {
          calls.push('publishVehicle');
          published.push(vehiculo);
        },
        startTracking: async (trackingSession) => {
          calls.push(`startTracking:${trackingSession.vehiculoId}:${trackingSession.rutaId}`);
        },
      },
      session,
    );

    expect(calls).toEqual([
      'getCurrentPosition',
      'publishVehicle',
      'startTracking:uid-1:campo-verde-vuelta',
    ]);
    expect(published).toHaveLength(1);
    expect(published[0]).toEqual({
      vehiculo_id: 'uid-1',
      lat: 7.8939,
      lng: -72.5078,
      timestamp_ultima_actualizacion: 1_700_000_000_000,
      ruta_activa: 'campo-verde-vuelta',
      velocidad_actual: 12.5,
      en_servicio: true,
    });
    expect(resultado).toEqual(published[0]);
  });

  it('publishes velocidad_actual 0 when speed is null, negative or NaN', async () => {
    const speeds = [null, -3, Number.NaN];

    for (const speed of speeds) {
      const published: VehiculoActivo[] = [];

      await beginShift(
        {
          getCurrentPosition: async () => ({ ...position, speed }),
          publishVehicle: async (vehiculo) => {
            published.push(vehiculo);
          },
          startTracking: async () => undefined,
        },
        session,
      );

      expect(published[0].velocidad_actual).toBe(0);
    }
  });

  it('does not start tracking when publishing the vehicle fails', async () => {
    const calls: string[] = [];
    const error = new Error('firebase rechazó la escritura');

    const promise = beginShift(
      {
        getCurrentPosition: async () => {
          calls.push('getCurrentPosition');
          return position;
        },
        publishVehicle: async () => {
          calls.push('publishVehicle');
          throw error;
        },
        startTracking: async () => {
          calls.push('startTracking');
        },
      },
      session,
    );

    await expect(promise).rejects.toThrow('firebase rechazó la escritura');
    expect(calls).toEqual(['getCurrentPosition', 'publishVehicle']);
  });
});

describe('endShift', () => {
  it('stops tracking before marking the vehicle out of service', async () => {
    const calls: string[] = [];
    const serviceUpdates: [string, boolean][] = [];

    await endShift(
      {
        stopTracking: async () => {
          calls.push('stopTracking');
        },
        setService: async (vehiculoId, enServicio) => {
          calls.push('setService');
          serviceUpdates.push([vehiculoId, enServicio]);
        },
      },
      'uid-1',
    );

    expect(calls).toEqual(['stopTracking', 'setService']);
    expect(serviceUpdates).toEqual([['uid-1', false]]);
  });
});
