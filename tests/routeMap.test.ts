import { Camera } from '@maplibre/maplibre-react-native';
import { Children, isValidElement, type ComponentProps, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RouteMap } from '@/components/RouteMap';
import { PILOT_ROUTE } from '@/data/seed';

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

function cameraProps(ruta: ComponentProps<typeof RouteMap>['ruta']) {
  const view = RouteMap({ ruta, paradas: [], vehiculos: [], now: 0 });
  const map = Children.only(view.props.children) as ReactElement<{ children: ReactElement[] }>;
  const camera = Children.toArray(map.props.children).find(
    (child) => isValidElement<ComponentProps<typeof Camera>>(child) && child.type === Camera,
  );
  if (!isValidElement<ComponentProps<typeof Camera>>(camera)) throw new Error('Camera not rendered');
  return camera.props;
}

describe('RouteMap camera', () => {
  it('fits the entire route with padding', () => {
    const longitudes = PILOT_ROUTE.polyline.map(({ longitude }) => longitude);
    const latitudes = PILOT_ROUTE.polyline.map(({ latitude }) => latitude);
    expect(cameraProps(PILOT_ROUTE)).toMatchObject({
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

  it('keeps the default camera while the route loads', () => {
    expect(cameraProps(null)).toMatchObject({ center: [-72.5008, 7.898], zoom: 13.5 });
  });
});
