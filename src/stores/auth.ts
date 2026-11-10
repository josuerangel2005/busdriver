import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { STORAGE_KEYS, USE_MOCK } from '@/constants/config';
import type { UserRole } from '@/types/models';

function firebaseAuth() {
  return require('@react-native-firebase/auth') as typeof import('@react-native-firebase/auth');
}

async function resolveUid(): Promise<string> {
  if (USE_MOCK) {
    return `mock-${Math.random().toString(36).slice(2, 10)}`;
  }
  const { getAuth, signInAnonymously } = firebaseAuth();
  const credential = await signInAnonymously(getAuth());
  return credential.user.uid;
}

type AuthState = {
  uid: string | null;
  role: UserRole | null;
  ready: boolean;
  signIn: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  role: null,
  ready: false,

  async signIn(role) {
    const uid = await resolveUid();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.uid, uid],
      [STORAGE_KEYS.role, role],
    ]);
    set({ uid, role });
  },

  async signOut() {
    await AsyncStorage.multiRemove([STORAGE_KEYS.uid, STORAGE_KEYS.role]);
    if (!USE_MOCK) {
      const { getAuth, signOut } = firebaseAuth();
      await signOut(getAuth());
    }
    set({ uid: null, role: null });
  },

  async hydrate() {
    const entries = await AsyncStorage.multiGet([
      STORAGE_KEYS.uid,
      STORAGE_KEYS.role,
    ]);
    const uid = entries[0][1];
    const role = entries[1][1] as UserRole | null;
    set({ uid, role, ready: true });
  },
}));
