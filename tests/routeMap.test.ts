import { Camera } from '@maplibre/maplibre-react-native';
import { Children, isValidElement, type ComponentProps, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { spacing } from '@/constants/theme';
import { RouteMap } from '@/components/RouteMap';
import { bundledCatalog, findRoute } from '@/lib/routeCatalog';

const directRoute = findRoute(bundledCatalog, 'directo-cucuta-ida')!;

vi.mock('@maplibre/maplibre-react-native', () => ({
  Camera: () => null,
  GeoJSONSource: () => null,
  Layer: () => null,
  Map: () => null,
  Marker: () => null,
}));

vi.mock('react-native', () => ({
  Pressable: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
  Text: () => null,
  View: () => null,
}));

function routeCamera(ruta: ComponentProps<typeof RouteMap>['ruta'], placardHeight?: number) {
  const view = RouteMap({ ruta, paradas: [], vehiculos: [], now: 0, placardHeight });
  const map = Children.only(view.props.children) as ReactElement<{ children: ReactElement[] }>;
  const camera = Children.toArray(map.props.children).find(
    (child) => isValidElement<ComponentProps<typeof Camera>>(child) && child.type === Camera,
  );
  if (!isValidElement<ComponentProps<typeof Camera>>(camera)) throw new Error('Camera not rendered');
  return camera;
}

describe('RouteMap camera', () => {
  it('fits the entire route with padding', () => {
    const longitudes = directRoute.polyline.map(({ longitude }) => longitude);
    const latitudes = directRoute.polyline.map(({ latitude }) => latitude);
    expect(routeCamera(directRoute).props).toMatchObject({
      bounds: [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
      ],
      padding: {
        top: 180,
        right: 40,
        bottom: 40,
        left: 40,
      },
    });
  });

  it('reserves the measured placard height plus a margin above the route', () => {
    expect(routeCamera(directRoute, 120).props.padding).toEqual({
      top: 120 + spacing.xl,
      right: 40,
      bottom: 40,
      left: 40,
    });
  });

  it('recreates the camera when switching directions with the same route bounds', () => {
    const outbound = routeCamera(directRoute);
    const inbound = routeCamera(findRoute(bundledCatalog, 'directo-cucuta-vuelta')!);
    if (!('bounds' in outbound.props)) throw new Error('Outbound bounds not rendered');
    expect(inbound.props).toMatchObject({ bounds: outbound.props.bounds });
    expect(inbound.key).not.toBe(outbound.key);
  });

  it('keeps the default camera while the route loads', () => {
    expect(routeCamera(null).props).toMatchObject({ center: [-72.5008, 7.898], zoom: 13.5 });
  });
});
