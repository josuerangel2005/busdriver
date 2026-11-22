import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/config';
import { colors, font, radius, spacing } from '@/constants/theme';
import { getRouteBounds, toLineString } from '@/lib/geo';
import type { LatLng } from '@/types/models';

const DEFAULT_CENTER: [number, number] = [-72.5008, 7.898];

type Props = {
  disabled: boolean;
  polyline: LatLng[];
  markers: { id: number; point: LatLng }[];
  mode: 'trace' | 'stops';
  onTap(point: LatLng): void;
};

export function AdminRouteMap({ disabled, polyline, markers, mode, onTap }: Props) {
  const [initialViewState] = useState(() => {
    const bounds = getRouteBounds(polyline);
    return bounds ? { bounds, padding: { top: spacing.xl, bottom: spacing.xl, left: spacing.xl, right: spacing.xl } } : { center: DEFAULT_CENTER, zoom: 13 };
  });
  return (
    <View style={styles.frame}>
      <Map
        mapStyle={MAP_STYLE_URL}
        style={styles.map}
        androidView="texture"
        accessibilityRole="image"
        accessibilityLabel={mode === 'trace' ? 'Mapa del trazado. Toca un lugar para agregar un punto.' : 'Mapa de paraderos. Toca un lugar para agregar un paradero.'}
        accessibilityState={{ disabled }}
        onPress={({ nativeEvent: { lngLat: [longitude, latitude] } }) => onTap({ latitude, longitude })}
      >
        <Camera initialViewState={initialViewState} />
        {polyline.length >= 2 && (
          <GeoJSONSource id="admin-trace" data={toLineString({ polyline })}>
            <Layer
              id="admin-route"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.signBlue, 'line-width': 5 }}
            />
          </GeoJSONSource>
        )}
        {markers.map(({ id, point }, index) => (
          <Marker key={`${mode}-${id}`} lngLat={[point.longitude, point.latitude]} anchor="center">
            <View
              pointerEvents="none"
              style={[styles.marker, mode === 'stops' && styles.stop]}
            >
              <Text style={[styles.number, mode === 'stops' && styles.stopNumber]}>{index + 1}</Text>
            </View>
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 300, borderRadius: radius.control, overflow: 'hidden', backgroundColor: colors.passedGround },
  map: { flex: 1 },
  marker: {
    minWidth: 26, height: 26, paddingHorizontal: spacing.xs, borderRadius: radius.control, borderWidth: 2,
    borderColor: colors.ink, backgroundColor: colors.signYellow, alignItems: 'center', justifyContent: 'center',
  },
  stop: { backgroundColor: colors.signBlue },
  number: { color: colors.ink, fontSize: font.body, fontWeight: '700' },
  stopNumber: { color: colors.onBlue },
});
