import { withTimeout } from '@/lib/withTimeout';
import type { ConnectionStatus } from '@/stores/connection';
import type { Consentimiento } from '@/types/models';

import type { Repository } from './repository';

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type ConsentStatus = 'accepted' | 'required' | 'unavailable';

function consentKey(uid: string) {
  return `@buseta/consent/${uid}`;
}

async function cacheConsent(storage: Storage, uid: string, consent: Consentimiento | null) {
  const key = consentKey(uid);
  try {
    if (consent) await storage.setItem(key, JSON.stringify(consent));
    else await storage.removeItem(key);
  } catch {
    // Cache failure must not override a definitive repository response.
  }
}

async function cachedStatus(storage: Storage, uid: string): Promise<ConsentStatus> {
  try {
    const value = await storage.getItem(consentKey(uid));
    if (value && JSON.parse(value)?.aceptado === true) return 'accepted';
  } catch {
    // Unreadable cache cannot establish prior acceptance.
  }
  return 'unavailable';
}

export async function loadConsent(
  repository: Pick<Repository, 'getConsent'>,
  storage: Storage,
  uid: string,
  connection: ConnectionStatus,
): Promise<ConsentStatus> {
  if (connection === 'offline') return cachedStatus(storage, uid);

  let consent: Consentimiento | null;
  try {
    consent = await withTimeout(repository.getConsent(uid), 5000);
  } catch {
    return cachedStatus(storage, uid);
  }
  await cacheConsent(storage, uid, consent);
  return consent?.aceptado === true ? 'accepted' : 'required';
}

export async function saveAcceptedConsent(
  repository: Pick<Repository, 'saveConsent'>,
  storage: Storage,
  uid: string,
  consent: Consentimiento,
): Promise<void> {
  await withTimeout(repository.saveConsent(uid, consent), 5000);
  await cacheConsent(storage, uid, consent);
}
