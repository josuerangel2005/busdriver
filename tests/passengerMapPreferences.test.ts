import { expect, it } from 'vitest';

import { spacing } from '@/constants/theme';
import { favoriteFirst, readFavoriteStop, resolveFavoriteStop, saveFavoriteStop } from '@/lib/favoriteStop';
import { readCleanMapMode, routeMapPadding, saveCleanMapMode } from '@/lib/passengerMapMode';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}

const unavailable = async () => { throw new Error('storage unavailable'); };

it('puts the favorite first without changing other stops or mutating the list', () => {
  const stops = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(favoriteFirst(stops, 'c', (stop) => stop.id)).toEqual([stops[2], stops[0], stops[1]]);
  expect(favoriteFirst(stops, 'missing', (stop) => stop.id)).toBe(stops);
  expect(stops.map((stop) => stop.id)).toEqual(['a', 'b', 'c']);
});

it('resolves a saved ID only against the current stops', () => {
  const stops = [{ id: 'a' }];
  expect(resolveFavoriteStop(stops, 'a')).toBe(stops[0]);
  expect(resolveFavoriteStop(stops, 'removed')).toBeNull();
  expect(resolveFavoriteStop(stops, null)).toBeNull();
});

it('saves, replaces and removes one favorite per route direction', async () => {
  const storage = memoryStorage();
  await saveFavoriteStop(storage, 'ida', 'a');
  await saveFavoriteStop(storage, 'vuelta', 'b');
  await saveFavoriteStop(storage, 'ida', 'c');
  await expect(readFavoriteStop(storage, 'ida')).resolves.toBe('c');
  await saveFavoriteStop(storage, 'ida', null);
  await expect(readFavoriteStop(storage, 'ida')).resolves.toBeNull();
  await expect(readFavoriteStop(storage, 'vuelta')).resolves.toBe('b');
});

it('keeps the favorite preference optional when storage fails', async () => {
  const storage = { getItem: unavailable, setItem: unavailable, removeItem: unavailable };
  await expect(readFavoriteStop(storage, 'ida')).resolves.toBeNull();
  await expect(saveFavoriteStop(storage, 'ida', 'a')).resolves.toBeUndefined();
  await expect(saveFavoriteStop(storage, 'ida', null)).resolves.toBeUndefined();
});

it('restores map mode and falls back to information for missing, invalid, or unavailable storage', async () => {
  const storage = memoryStorage();
  await expect(readCleanMapMode(storage)).resolves.toBe(false);
  await saveCleanMapMode(storage, true);
  await expect(readCleanMapMode(storage)).resolves.toBe(true);
  await saveCleanMapMode(storage, false);
  await expect(readCleanMapMode(storage)).resolves.toBe(false);
  await expect(readCleanMapMode({ getItem: async () => 'invalid' })).resolves.toBe(false);
  await expect(readCleanMapMode({ getItem: unavailable })).resolves.toBe(false);
  await expect(saveCleanMapMode({ setItem: unavailable }, true)).resolves.toBeUndefined();
});

it('uses smaller padding in clean mode and keeps the measured header spacing otherwise', () => {
  expect(routeMapPadding(false)).toBeUndefined();
  expect(routeMapPadding(false, 120, { width: 360, height: 420 })).toEqual({ top: 120 + spacing.xl, right: 40, bottom: 40, left: 40 });
  expect(routeMapPadding(true, undefined, { width: 360, height: 640 })).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
});
