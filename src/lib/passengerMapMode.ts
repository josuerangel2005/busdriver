import { spacing } from '@/constants/theme';

const MODE_KEY = 'passenger_clean_map';

export async function readCleanMapMode(storage: { getItem(key: string): Promise<string | null> }) {
  try {
    return (await storage.getItem(MODE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveCleanMapMode(
  storage: { setItem(key: string, value: string): Promise<void> }, clean: boolean,
) {
  try {
    await storage.setItem(MODE_KEY, String(clean));
  } catch {
    // Keep the current mode when storage is unavailable.
  }
}

export function routeMapPadding(
  clean: boolean,
  placardHeight?: number,
  viewport?: { width: number; height: number },
) {
  if (!viewport || (!clean && !placardHeight)) return undefined;

  // The native map is already above the stops panel. Only the placard overlays it.
  const margin = clean ? 24 : 40;
  const top = clean ? margin : (placardHeight ?? 0) + spacing.xl;
  if (viewport.height <= top + margin || viewport.width <= 2 * margin) return undefined;
  return { top, right: margin, bottom: margin, left: margin };
}
