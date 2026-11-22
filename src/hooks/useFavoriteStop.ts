import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

import { readFavoriteStop, resolveFavoriteStop, saveFavoriteStop } from '@/lib/favoriteStop';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { Parada } from '@/types/models';

const useFavorites = create<{ ids: ReadonlyMap<string, string | null> }>(() => ({ ids: new Map() }));

function updateFavorite(routeId: string, stopId: string | null) {
  useFavorites.setState(({ ids }) => ({ ids: new Map(ids).set(routeId, stopId) }));
}

export function useFavoriteStop(routeId: string | undefined, stops: readonly Parada[]) {
  const savedId = useFavorites(({ ids }) => routeId === undefined ? undefined : ids.get(routeId));
  const source = useRouteCatalog(({ catalog }) => catalog.source);
  const favorite = resolveFavoriteStop(stops, savedId ?? null);

  useEffect(() => {
    if (routeId === undefined || savedId !== undefined) return;
    let active = true;
    void readFavoriteStop(AsyncStorage, routeId).then((id) => {
      if (active && !useFavorites.getState().ids.has(routeId)) updateFavorite(routeId, id);
    });
    return () => { active = false; };
  }, [routeId, savedId]);

  useEffect(() => {
    // The startup fallback may not know about stops added to the live catalog.
    if (routeId !== undefined && source === 'remote' && savedId && !favorite
      && useFavorites.getState().ids.get(routeId) === savedId) {
      updateFavorite(routeId, null);
      void saveFavoriteStop(AsyncStorage, routeId, null);
    }
  }, [favorite, routeId, savedId, source]);

  function setFavorite(stopId: string | null) {
    if (routeId === undefined) return;
    updateFavorite(routeId, stopId);
    void saveFavoriteStop(AsyncStorage, routeId, stopId);
  }

  return { favorite, setFavorite };
}
