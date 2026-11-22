import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/constants/config';
import { useAuthStore } from '@/stores/auth';

const fakes = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const auth = { currentUser: null as { uid: string; isAnonymous: boolean } | null, authStateReady: vi.fn() };
  return {
    storage,
    auth,
    mode: { mock: false },
    isAdmin: vi.fn<(uid: string) => Promise<boolean>>(),
    emailSignIn: vi.fn(async () => {
      const user = { uid: 'admin-uid', isAnonymous: false };
      auth.currentUser = user;
      return { user };
    }),
    anonymousSignIn: vi.fn(async () => ({ user: { uid: 'anonymous-uid', isAnonymous: true } })),
    signOut: vi.fn(async () => { auth.currentUser = null; }),
  };
});

vi.mock('@/constants/config', async (original) => ({
  ...await original<typeof import('@/constants/config')>(),
  get USE_MOCK() { return fakes.mode.mock; },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    multiGet: async (keys: string[]) => keys.map((key) => [key, fakes.storage.get(key) ?? null]),
    multiSet: async (entries: [string, string][]) => entries.forEach(([key, value]) => fakes.storage.set(key, value)),
    multiRemove: async (keys: string[]) => keys.forEach((key) => fakes.storage.delete(key)),
  },
}));
vi.mock('@react-native-firebase/auth', () => ({
  getAuth: () => fakes.auth,
  signInWithEmailAndPassword: fakes.emailSignIn,
  signInAnonymously: fakes.anonymousSignIn,
  signOut: fakes.signOut,
}));
vi.mock('@/services/repository', () => ({ getRepository: () => ({ isAdmin: fakes.isAdmin }) }));

const state = useAuthStore.getState;

beforeEach(() => {
  vi.clearAllMocks();
  fakes.mode.mock = false;
  fakes.storage.clear();
  fakes.auth.currentUser = null;
  fakes.isAdmin.mockResolvedValue(true);
  useAuthStore.setState({ uid: null, role: null, ready: false });
});

describe('admin authentication', () => {
  it('verifies email sign-in before persisting the admin role', async () => {
    await state().signInAdmin('admin@example.test', 'secret');
    expect(fakes.emailSignIn).toHaveBeenCalledWith(fakes.auth, 'admin@example.test', 'secret');
    expect(fakes.isAdmin).toHaveBeenCalledWith('admin-uid');
    expect(fakes.anonymousSignIn).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ uid: 'admin-uid', role: 'admin' });
    expect(fakes.storage.get(STORAGE_KEYS.role)).toBe('admin');
    expect(fakes.storage.get(STORAGE_KEYS.uid)).toBe('admin-uid');
  });

  it('clears the sign-in loading flag when the email handler throws', async () => {
    const failure = new Error('Rejected sign-in');
    fakes.emailSignIn.mockRejectedValueOnce(failure);
    const signingIn = state().signInAdmin('admin@example.test', 'secret');
    expect(state().adminSigningIn).toBe(true);
    await expect(signingIn).rejects.toBe(failure);
    expect(state().adminSigningIn).toBe(false);
  });

  it('signs out an authenticated account without admin permissions', async () => {
    fakes.isAdmin.mockResolvedValue(false);
    await expect(state().signInAdmin('user@example.test', 'secret')).rejects.toMatchObject({ code: 'admin/not-allowed' });
    expect(fakes.signOut).toHaveBeenCalledWith(fakes.auth);
    expect(fakes.auth.currentUser).toBeNull();
    expect(state()).toMatchObject({ uid: null, role: null });
    expect(fakes.storage.size).toBe(0);
  });

  it.each(['missing user', 'anonymous user', 'wrong uid', 'revoked permission', 'failed read'])(
    'clears a stored admin session on hydrate: %s',
    async (failure) => {
      fakes.storage.set(STORAGE_KEYS.uid, 'admin-uid');
      fakes.storage.set(STORAGE_KEYS.role, 'admin');
      if (failure !== 'missing user') {
        fakes.auth.currentUser = {
          uid: failure === 'wrong uid' ? 'other' : 'admin-uid',
          isAnonymous: failure === 'anonymous user',
        };
      }
      if (failure === 'revoked permission') fakes.isAdmin.mockResolvedValue(false);
      if (failure === 'failed read') fakes.isAdmin.mockRejectedValueOnce(new Error('offline'));
      await state().hydrate();
      expect(state()).toMatchObject({ uid: null, role: null, ready: true });
      expect(fakes.storage.size).toBe(0);
      expect(fakes.auth.currentUser).toBeNull();
    },
  );

  it('restores a stored admin only after checking the current user and allowlist', async () => {
    fakes.storage.set(STORAGE_KEYS.uid, 'admin-uid');
    fakes.storage.set(STORAGE_KEYS.role, 'admin');
    fakes.auth.currentUser = { uid: 'admin-uid', isAnonymous: false };
    await state().hydrate();
    expect(fakes.auth.authStateReady).toHaveBeenCalled();
    expect(fakes.isAdmin).toHaveBeenCalledWith('admin-uid');
    expect(state()).toMatchObject({ uid: 'admin-uid', role: 'admin', ready: true });
  });

  it.each(['pasajero', 'conductor'] as const)('clears admin on sign-out and signs in %s anonymously', async (role) => {
    await state().signInAdmin('admin@example.test', 'secret');
    await state().signOut();
    expect(fakes.signOut).toHaveBeenCalledWith(fakes.auth);
    expect(fakes.storage.size).toBe(0);
    expect(state()).toMatchObject({ uid: null, role: null });
    await state().signIn(role);
    expect(fakes.anonymousSignIn).toHaveBeenCalledWith(fakes.auth);
    expect(state()).toMatchObject({ uid: 'anonymous-uid', role });
  });

  it('accepts only the demo credentials in mock mode without Firebase Auth', async () => {
    fakes.mode.mock = true;
    await expect(state().signInAdmin('admin@demo.local', 'wrong')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    await state().signInAdmin('admin@demo.local', 'demo1234');
    expect(state().role).toBe('admin');
    expect(fakes.isAdmin).toHaveBeenCalledWith(state().uid);
    expect(fakes.emailSignIn).not.toHaveBeenCalled();
    await state().hydrate();
    expect(state()).toMatchObject({ role: 'admin', ready: true });
  });
});

it('does not switch to an anonymous user while admin verification is pending', async () => {
  let completeVerification!: (allowed: boolean) => void;
  let verificationStarted!: () => void;
  const started = new Promise<void>((resolve) => { verificationStarted = resolve; });
  fakes.isAdmin.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
    completeVerification = resolve;
    verificationStarted();
  }));
  const signingIn = state().signInAdmin('admin@example.test', 'secret');
  await started;
  const switching = state().signIn('pasajero');
  const blocked = expect(switching).rejects.toMatchObject({ code: 'admin/session-active' });
  try {
    await blocked;
    expect(fakes.anonymousSignIn).not.toHaveBeenCalled();
  } finally {
    completeVerification(true);
    await signingIn;
  }
  expect(state().role).toBe('admin');
});

it.each([true, false])('keeps a timed-out admin unverified and applies the reconnect answer (%s)', async (allowed) => {
  vi.useFakeTimers();
  try {
    fakes.storage.set(STORAGE_KEYS.uid, 'admin-uid');
    fakes.storage.set(STORAGE_KEYS.role, 'admin');
    fakes.auth.currentUser = { uid: 'admin-uid', isAnonymous: false };
    let started!: () => void;
    const checking = new Promise<void>((resolve) => { started = resolve; });
    fakes.isAdmin.mockImplementationOnce(() => new Promise(() => { started(); }));
    const hydration = state().hydrate();
    await checking;
    await vi.advanceTimersByTimeAsync(5000);
    expect(state()).toMatchObject({ role: 'admin', uid: 'admin-uid', ready: true, adminVerified: false });
    await hydration;
    expect(fakes.storage.get(STORAGE_KEYS.role)).toBe('admin');
    expect(fakes.signOut).not.toHaveBeenCalled();

    fakes.isAdmin.mockResolvedValueOnce(allowed);
    await state().reverifyAdmin();
    expect(state()).toMatchObject({ role: allowed ? 'admin' : null, adminVerified: allowed });
    expect(fakes.storage.has(STORAGE_KEYS.role)).toBe(allowed);
    expect(fakes.signOut).toHaveBeenCalledTimes(allowed ? 0 : 1);
  } finally {
    vi.useRealTimers();
  }
});
