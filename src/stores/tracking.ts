import { create } from 'zustand';

import { getTrackingSession, isTracking } from '@/services/tracking';
import type { TrackingSession } from '@/services/tracking';

type TrackingState = {
  active: boolean;
  session: TrackingSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActive: (active: boolean, session?: TrackingSession | null) => void;
};

export const useTrackingStore = create<TrackingState>((set) => ({
  active: false,
  session: null,
  loading: true,

  async refresh() {
    set({ loading: true });
    try {
      const [active, session] = await Promise.all([isTracking(), getTrackingSession()]);
      set({ active, session });
    } finally {
      set({ loading: false });
    }
  },

  setActive(active, session) {
    set({ active, session: session ?? null });
  },
}));
