import AsyncStorage from '@react-native-async-storage/async-storage';
import { expect, it, vi } from 'vitest';

import { getTrackingSession, updateTrackingDirection, withTrackingWrite } from '@/services/tracking';

vi.mock('expo-location', () => ({}));
vi.mock('@react-native-async-storage/async-storage', () => {
  let session: string | null = null;
  return { default: {
    getItem: async () => session,
    setItem: async (_key: string, value: string) => { session = value; },
  } };
});

const previous = { vehiculoId: 'driver', rutaId: 'natura-ida' };
const next = { ...previous, rutaId: 'natura-vuelta' };

it('does not let a location publication with the old direction overtake a switch', async () => {
  await AsyncStorage.setItem('tracking_session', JSON.stringify(previous));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const order: string[] = [];
  const oldPing = withTrackingWrite(async () => {
    const session = await getTrackingSession();
    await gate;
    order.push(session!.rutaId);
  });
  const switchDirection = updateTrackingDirection(previous, next, async () => {
    order.push('switch');
  });
  const nextPing = withTrackingWrite(async () => {
    order.push((await getTrackingSession())!.rutaId);
  });
  release();
  await Promise.all([oldPing, switchDirection, nextPing]);
  expect(order).toEqual(['natura-ida', 'switch', 'natura-vuelta']);
});

it('restores the previous tracking session if the backend update fails', async () => {
  await expect(updateTrackingDirection(previous, next, async () => {
    throw new Error('offline');
  })).rejects.toThrow('offline');
  await expect(getTrackingSession()).resolves.toEqual(previous);
});
