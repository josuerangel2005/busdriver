import { afterEach, describe, expect, it, vi } from 'vitest';

import { passengerStatus, shiftStartBlock } from '@/lib/offlinePresentation';
import { TimeoutError, withTimeout } from '@/lib/withTimeout';
import { loadConsent, saveAcceptedConsent } from '@/services/consent';
import { endShift } from '@/services/shift';
import { connectConnection, useConnection } from '@/stores/connection';

const pending = <T>() => new Promise<T>(() => {});
const accepted = { aceptado: true, version: '1', timestamp: 123 };

afterEach(() => vi.useRealTimers());

it('preserves promise results and errors, and bounds a pending operation', async () => {
  vi.useFakeTimers();
  await expect(withTimeout(Promise.resolve(42), 5000)).resolves.toBe(42);
  const failure = new Error('denied');
  await expect(withTimeout(Promise.reject(failure), 5000)).rejects.toBe(failure);
  const assertion = expect(withTimeout(pending(), 5000)).rejects.toBeInstanceOf(TimeoutError);
  await vi.advanceTimersByTimeAsync(5000);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

it('debounces continuous loss, ignores duplicate false reports, and reconnects immediately', async () => {
  vi.useFakeTimers();
  let report!: (online: boolean) => void;
  const unsubscribe = vi.fn();
  const disconnect = connectConnection((receive) => { report = receive; return unsubscribe; });
  const status = () => useConnection.getState().status;
  try {
    expect(status()).toBe('unknown');
    report(false);
    await vi.advanceTimersByTimeAsync(2999);
    expect(status()).toBe('unknown');
    report(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(status()).toBe('online');
    report(false);
    await vi.advanceTimersByTimeAsync(2000);
    report(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(status()).toBe('offline');
    report(true);
    expect(status()).toBe('online');
    report(false);
  } finally {
    disconnect();
  }
  await vi.advanceTimersByTimeAsync(3000);
  expect(status()).toBe('unknown');
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it('prioritizes the offline passenger banner and restores the usual states on reconnect', () => {
  const offline = { label: 'Sin conexión', tone: 'danger', banner: 'Sin conexión. Mostrando la última información disponible.' };
  expect(passengerStatus('offline', false, false)).toEqual(offline);
  expect(passengerStatus('offline', true, true)).toEqual(offline);
  expect(passengerStatus('unknown', false, false)).toMatchObject({ label: 'Sin unidades', banner: null });
  expect(passengerStatus('online', true, false)).toMatchObject({ label: 'En servicio', banner: null });
  expect(passengerStatus('online', true, true)).toMatchObject({ label: 'Desactualizado', banner: null });
});

it('blocks starting offline and allows starting online', () => {
  expect(shiftStartBlock('offline')).toBe('Necesitas conexión para iniciar el turno.');
  expect(shiftStartBlock('online')).toBeNull();
});

describe('consent cache', () => {
  function setup() {
    const entries = new Map<string, string>();
    return {
      storage: {
        getItem: async (key: string) => entries.get(key) ?? null,
        setItem: vi.fn(async (key: string, value: string) => { entries.set(key, value); }),
        removeItem: async (key: string) => { entries.delete(key); },
      },
      repository: { getConsent: vi.fn<() => Promise<typeof accepted | null>>(), saveConsent: vi.fn(async () => {}) },
    };
  }

  it('uses the accepted cache offline only for the same UID, without a remote read', async () => {
    const { repository, storage } = setup();
    await saveAcceptedConsent(repository, storage, 'driver', accepted);
    expect(repository.saveConsent).toHaveBeenCalledWith('driver', accepted);
    await expect(loadConsent(repository, storage, 'driver', 'offline')).resolves.toBe('accepted');
    await expect(loadConsent(repository, storage, 'other', 'offline')).resolves.toBe('unavailable');
    expect(repository.getConsent).not.toHaveBeenCalled();
  });

  it('falls back after five seconds, with or without a cached acceptance', async () => {
    vi.useFakeTimers();
    const { repository, storage } = setup();
    await saveAcceptedConsent(repository, storage, 'driver', accepted);
    repository.getConsent.mockImplementation(pending);
    const cached = loadConsent(repository, storage, 'driver', 'unknown');
    const empty = loadConsent(repository, storage, 'other', 'unknown');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(cached).resolves.toBe('accepted');
    await expect(empty).resolves.toBe('unavailable');
  });

  it('caches a successful read and invalidates an old acceptance on a definitive missing result', async () => {
    const { repository, storage } = setup();
    repository.getConsent.mockResolvedValueOnce(accepted).mockResolvedValueOnce(null);
    await expect(loadConsent(repository, storage, 'driver', 'online')).resolves.toBe('accepted');
    expect(storage.setItem).toHaveBeenCalledOnce();
    await expect(loadConsent(repository, storage, 'driver', 'offline')).resolves.toBe('accepted');
    await expect(loadConsent(repository, storage, 'driver', 'online')).resolves.toBe('required');
    await expect(loadConsent(repository, storage, 'driver', 'offline')).resolves.toBe('unavailable');
  });
});

it('stops tracking and returns even when closing the shift is queued offline', async () => {
  vi.useFakeTimers();
  const stopTracking = vi.fn(async () => {});
  const setService = vi.fn(pending<void>);
  const ending = endShift({ stopTracking, setService }, 'driver');
  await vi.advanceTimersByTimeAsync(2000);
  await expect(ending).resolves.toBeUndefined();
  expect(stopTracking).toHaveBeenCalledBefore(setService);
  expect(setService).toHaveBeenCalledWith('driver', false);
});
