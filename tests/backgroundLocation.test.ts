import { expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '@/constants/config';
import { withTrackingWrite } from '@/services/tracking';

const fakes = vi.hoisted(() => ({
  task: undefined as ((event: unknown) => Promise<void>) | undefined,
  publishVehicle: vi.fn(() => new Promise<void>(() => {})),
  logPing: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('expo-location', () => ({}));
vi.mock('expo-task-manager', () => ({ defineTask: (_: string, task: typeof fakes.task) => { fakes.task = task; } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => key === STORAGE_KEYS.trackingSession
      ? JSON.stringify({ vehiculoId: 'driver', rutaId: 'route' })
      : null,
    setItem: fakes.setItem,
  },
}));
vi.mock('@/lib/fieldLog', () => ({ logPing: fakes.logPing }));
vi.mock('@/services/repository', () => ({ getRepository: () => ({ publishVehicle: fakes.publishVehicle }) }));

it('finishes a stalled background write after eight seconds and logs a failed ping', async () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    await import('@/tasks/backgroundLocation');
    const task = fakes.task!;
    const result = task({ data: { locations: [{ timestamp: 123, coords: { latitude: 7, longitude: -72, speed: 0 } }] } });
    const finished = vi.fn();
    void result.then(finished);
    const nextWrite = vi.fn(async () => {});
    const queued = withTrackingWrite(nextWrite);
    await vi.advanceTimersByTimeAsync(7999);
    expect(finished).not.toHaveBeenCalled();
    expect(nextWrite).not.toHaveBeenCalled();
    expect(fakes.logPing).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(finished).toHaveBeenCalledOnce();
    await expect(queued).resolves.toBeUndefined();
    expect(nextWrite).toHaveBeenCalledOnce();
    expect(fakes.logPing).toHaveBeenCalledExactlyOnceWith({
      vehiculo_id: 'driver', timestamp_gps: 123, enviado_en: Date.now(), ok: false, error: 'timeout',
    });
    expect(fakes.setItem).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    vi.useRealTimers();
  }
});
