import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { STORAGE_KEYS, USE_MOCK } from '@/constants/config';
import { TimeoutError, withTimeout } from '@/lib/withTimeout';
import { DEMO_ADMIN } from '@/services/demoAdmin';
import { getRepository } from '@/services/repository';
import type { UserRole } from '@/types/models';

type TravelRole = Exclude<UserRole, 'admin'>;

const authKeys = [STORAGE_KEYS.uid, STORAGE_KEYS.role];
let adminRecheck: Promise<void> | undefined;
let sessionRevision = 0;

function firebaseAuth() {
  return import('@react-native-firebase/auth');
}

async function resolveUid(): Promise<string> {
  if (USE_MOCK) {
    return `mock-${Math.random().toString(36).slice(2, 10)}`;
  }
  const { getAuth, signInAnonymously, signOut } = await firebaseAuth();
  const auth = getAuth();
  await auth.authStateReady();
  if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
  const credential = await signInAnonymously(auth);
  return credential.user.uid;
}

function persistRole(uid: string, role: UserRole) {
  return AsyncStorage.multiSet([
    [STORAGE_KEYS.uid, uid],
    [STORAGE_KEYS.role, role],
  ]);
}

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

async function revokeNativeSession() {
  if (USE_MOCK) return;
  const { getAuth, signOut } = await firebaseAuth();
  const auth = getAuth();
  if (auth.currentUser) await signOut(auth);
}

async function canRestoreAdmin(uid: string | null): Promise<boolean> {
  if (!uid) return false;

  if (!USE_MOCK) {
    const { getAuth } = await firebaseAuth();
    const auth = getAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user || user.isAnonymous || user.uid !== uid) return false;
    if (await withTimeout(getRepository().isAdmin(uid), 5000) !== true) return false;
    return auth.currentUser?.uid === uid && !auth.currentUser.isAnonymous;
  }

  return await withTimeout(getRepository().isAdmin(uid), 5000) === true;
}

type AuthState = {
  uid: string | null;
  role: UserRole | null;
  ready: boolean;
  adminSigningIn: boolean;
  adminVerified: boolean;
  reverifyAdmin: () => Promise<void>;
  signIn: (role: TravelRole) => Promise<void>;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  uid: null,
  role: null,
  ready: false,
  adminSigningIn: false,
  adminVerified: false,

  async signIn(role) {
    if (get().adminSigningIn || get().role === 'admin') throw authError('admin/session-active');
    const uid = await resolveUid();
    await persistRole(uid, role);
    set({ uid, role });
  },

  async signInAdmin(email, password) {
    if (get().role || get().adminSigningIn) throw authError('admin/session-active');
    set({ adminSigningIn: true });
    try {
      let uid: string;
      let matchesNativeSession = () => true;
      if (USE_MOCK) {
        if (email.toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
          throw authError('auth/invalid-credential');
        }
        uid = DEMO_ADMIN.uid;
      } else {
        const { getAuth, signInWithEmailAndPassword } = await firebaseAuth();
        const auth = getAuth();
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        uid = user.uid;
        matchesNativeSession = () => auth.currentUser?.uid === uid && !auth.currentUser.isAnonymous;
      }

      try {
        if (!matchesNativeSession() || await getRepository().isAdmin(uid) !== true || !matchesNativeSession()) {
          throw authError('admin/not-allowed');
        }
        await persistRole(uid, 'admin');
      } catch (error) {
        // Try both cleanup steps without hiding the original authorization or network error.
        await Promise.allSettled([revokeNativeSession(), AsyncStorage.multiRemove(authKeys)]);
        throw error;
      }
      set({ uid, role: 'admin', adminVerified: true });
    } finally {
      set({ adminSigningIn: false });
    }
  },

  async signOut() {
    sessionRevision += 1;
    await AsyncStorage.multiRemove(authKeys);
    if (!USE_MOCK) {
      const { getAuth, signOut } = await firebaseAuth();
      await signOut(getAuth());
    }
    set({ uid: null, role: null, adminVerified: false });
  },

  async hydrate() {
    const entries = await AsyncStorage.multiGet(authKeys);
    const uid = entries[0][1];
    const role = entries[1][1];
    if (role === 'admin') {
      try {
        if (await canRestoreAdmin(uid)) {
          set({ uid, role, ready: true, adminVerified: true });
          return;
        }
      } catch (error) {
        if (error instanceof TimeoutError) {
          set({ uid, role, ready: true, adminVerified: false });
          return;
        }
      }
      await Promise.allSettled([AsyncStorage.multiRemove(authKeys), revokeNativeSession()]);
      set({ uid: null, role: null, ready: true, adminVerified: false });
      return;
    }
    set({ uid, role: role === 'conductor' || role === 'pasajero' ? role : null, ready: true, adminVerified: false });
  },

  async reverifyAdmin() {
    const { uid, role, adminVerified } = get();
    if (role !== 'admin' || !uid || adminVerified) return;
    if (adminRecheck) return adminRecheck;

    const revision = sessionRevision;
    adminRecheck = (async () => {
      const allowed = await canRestoreAdmin(uid).catch(() => undefined);
      if (allowed === undefined || sessionRevision !== revision || get().role !== 'admin' || get().uid !== uid) return;
      if (allowed) {
        set({ adminVerified: true });
      } else {
        await Promise.allSettled([AsyncStorage.multiRemove(authKeys), revokeNativeSession()]);
        if (sessionRevision === revision) set({ uid: null, role: null, adminVerified: false });
      }
    })();
    try {
      await adminRecheck;
    } finally {
      adminRecheck = undefined;
    }
  },
}));
