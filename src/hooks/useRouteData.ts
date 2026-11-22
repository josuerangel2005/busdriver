import { useEffect, useMemo, useState } from 'react';

import { DEFAULT_ROUTE_ID } from '@/constants/config';
import { vehiclesForRoute } from '@/lib/eta';
import { logLatency } from '@/lib/fieldLog';
import { createLatencyTracker } from '@/lib/fieldTest';
import { getRepository } from '@/services/repository';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

export function useRouteData(routeId: string = DEFAULT_ROUTE_ID) {
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoActivo[]>([]);

  useEffect(() => {
    const repository = getRepository();
    const unsubscribeRoute = repository.subscribeRoute(routeId, setRuta);
    const unsubscribeStops = repository.subscribeStops(routeId, setParadas);
    return () => {
      unsubscribeRoute();
      unsubscribeStops();
    };
  }, [routeId]);

  useEffect(() => {
    const trackLatencies = createLatencyTracker();
    return getRepository().subscribeVehicles((snapshot) => {
      const recibidoEn = Date.now();
      for (const entry of trackLatencies(snapshot, recibidoEn)) {
        logLatency(entry);
      }
      setVehiculos(snapshot);
    });
  }, []);

  const routeStops = useMemo(
    () => paradas.filter((stop) => stop.ruta_id === routeId).sort((a, b) => a.orden - b.orden),
    [paradas, routeId],
  );
  const routeVehicles = useMemo(() => vehiclesForRoute(vehiculos, routeId), [vehiculos, routeId]);

  return { ruta: ruta?.id === routeId ? ruta : null, paradas: routeStops, vehiculos: routeVehicles };
}

export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
