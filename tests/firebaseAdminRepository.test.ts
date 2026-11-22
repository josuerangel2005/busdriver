import { expect, it, vi } from 'vitest';

import { firebaseRepository } from '@/services/firebaseRepository';

const db = vi.hoisted(() => ({
  ref: vi.fn((_database: string, path: string) => path),
  update: vi.fn(async (_path: string, _changes: unknown) => {}),
  onValue: vi.fn<(path: string, receive: (snapshot: { val: () => unknown }) => void) => () => void>(),
  get: vi.fn(async (_path: string) => ({ val: (): unknown => null })),
}));

vi.mock('@react-native-firebase/database', () => ({
  getDatabase: () => 'database',
  ref: db.ref,
  get: db.get,
  onValue: db.onValue,
  update: db.update,
}));

it.each([
  [true, true],
  [false, false],
  ['true', false],
  [1, false],
  [null, false],
])('checks only the user’s allowlist entry and requires a boolean true (%j)', async (value, expected) => {
  db.get.mockResolvedValueOnce({ val: () => value });
  await expect(firebaseRepository.isAdmin('account-uid')).resolves.toBe(expected);
  expect(db.ref).toHaveBeenLastCalledWith('database', 'admins/account-uid');
  expect(db.get).toHaveBeenLastCalledWith('admins/account-uid');
});


it('uses exactly one root update for each admin operation', async () => {
  db.update.mockClear();
  const changes = { 'paradas/obsolete-id': null };
  await firebaseRepository.saveLine(changes);
  expect(db.ref).toHaveBeenLastCalledWith('database');
  expect(db.update).toHaveBeenCalledExactlyOnceWith(undefined, changes);

  db.update.mockClear();
  await firebaseRepository.setLineActive('test', false);
  expect(db.ref).toHaveBeenLastCalledWith('database');
  expect(db.update).toHaveBeenCalledExactlyOnceWith(undefined, {
    'rutas/test-ida/activa': false,
    'rutas/test-vuelta/activa': false,
  });
});

it('subscribes to the local Firebase connection flag and returns the unsubscribe', () => {
  const unsubscribe = vi.fn();
  const receive = vi.fn();
  db.onValue.mockReturnValueOnce(unsubscribe);
  expect(firebaseRepository.subscribeConnection(receive)).toBe(unsubscribe);
  expect(db.ref).toHaveBeenLastCalledWith('database', '.info/connected');
  const [path, notify] = db.onValue.mock.lastCall!;
  expect(path).toBe('.info/connected');
  notify({ val: () => false });
  notify({ val: () => true });
  expect(receive.mock.calls).toEqual([[false], [true]]);
});
