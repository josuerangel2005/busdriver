import { useEffect, useMemo, useState } from 'react';

import { DEFAULT_ROUTE_ID } from '@/constants/config';
import { vehiclesForRoute } from '@/lib/eta';
import { logLatency } from '@/lib/fieldLog';
import { createLatencyTracker } from '@/lib/fieldTest';
import { findRoute, stopsFor } from '@/lib/routeCatalog';
import { resolveRouteId } from '@/lib/routeSelection';
import { getRepository } from '@/services/repository';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { VehiculoActivo } from '@/types/models';

export function useRouteData(routeId: string = DEFAULT_ROUTE_ID, lineId?: string) {
  const { catalog, ready } = useRouteCatalog();
  const effectiveId = resolveRouteId(routeId, catalog, lineId);
  const [vehiculos, setVehiculos] = useState<VehiculoActivo[]>([]);

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

  const ruta = ready ? findRoute(catalog, effectiveId) ?? null : null;
  const paradas = useMemo(() => stopsFor(catalog, ruta?.id), [catalog, ruta?.id]);
  const routeVehicles = useMemo(
    () => ruta ? vehiclesForRoute(vehiculos, ruta.id) : [],
    [vehiculos, ruta],
  );

  return { ruta, paradas, vehiculos: routeVehicles };
}

export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
