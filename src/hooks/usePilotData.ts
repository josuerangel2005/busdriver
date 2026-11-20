import { useEffect, useState } from 'react';

import { PILOT_ROUTE_ID } from '@/constants/config';
import { logLatency } from '@/lib/fieldLog';
import { createLatencyTracker } from '@/lib/fieldTest';
import { getRepository } from '@/services/repository';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

export function usePilotData(routeId: string = PILOT_ROUTE_ID) {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoActivo[]>([]);

  useEffect(() => {
    const repository = getRepository();
    const trackLatencies = createLatencyTracker();
    const unsubscribeRoute = repository.subscribeRoute(routeId, setRuta);
    const unsubscribeStops = repository.subscribeStops(routeId, setParadas);
    const unsubscribeVehicles = repository.subscribeVehicles((snapshot) => {
      const recibidoEn = Date.now();
      for (const entry of trackLatencies(snapshot, recibidoEn)) {
        logLatency(entry);
      }
      setVehiculos(snapshot);
    });

    return () => {
      unsubscribeRoute();
      unsubscribeStops();
      unsubscribeVehicles();
    };
  }, [routeId]);

  return { ruta, paradas, vehiculos };
}

export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
