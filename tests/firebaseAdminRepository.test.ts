import { expect, it, vi } from 'vitest';

import { firebaseRepository } from '@/services/firebaseRepository';

const db = vi.hoisted(() => ({
  ref: vi.fn((_database: string, path: string) => path),
  get: vi.fn(async (_path: string) => ({ val: (): unknown => null })),
}));

vi.mock('@react-native-firebase/database', () => ({
  getDatabase: () => 'database',
  ref: db.ref,
  get: db.get,
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
