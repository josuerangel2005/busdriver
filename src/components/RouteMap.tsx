import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MAP_STYLE_URL } from '@/constants/config';
import { colors, fontFamily, radius } from '@/constants/theme';
import { isStale } from '@/lib/eta';
import { getRouteBounds } from '@/lib/geo';
import { routeMapPadding } from '@/lib/passengerMapMode';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

type Props = {
  ruta: Ruta | null;
  paradas: Parada[];
  vehiculos: VehiculoActivo[];
  selectedStopId?: string | null;
  onSelectStop?: (parada: Parada) => void;
  now: number;
  placardHeight?: number;
  cleanMode?: boolean;
  viewport?: { width: number; height: number };
  onViewportLayout: (event: LayoutChangeEvent) => void;
  favoriteStopId?: string | null;
};

const DEFAULT_CENTER: [number, number] = [-72.5008, 7.898];

export function RouteMap({
  ruta,
  paradas,
  vehiculos,
  selectedStopId,
  onSelectStop,
  now,
  placardHeight,
  cleanMode = false,
  viewport,
  onViewportLayout,
  favoriteStopId,
}: Props) {
  const bounds = ruta ? getRouteBounds(ruta.polyline) : undefined;
  const padding = routeMapPadding(cleanMode, placardHeight, viewport);
  const firstPoint = ruta?.polyline[0];
  const center: [number, number] = firstPoint
    ? [firstPoint.longitude, firstPoint.latitude]
    : DEFAULT_CENTER;

  const routeFeature: Feature<LineString> | null = ruta
    ? {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: ruta.polyline.map((point) => [point.longitude, point.latitude]),
        },
      }
    : null;

  return (
    <View style={styles.container}>
      <Map mapStyle={MAP_STYLE_URL} style={styles.map} onLayout={onViewportLayout}>
        {bounds && padding ? (
          <Camera
            key={`${ruta?.id}:${cleanMode}:${viewport?.width}:${viewport?.height}:${padding.top}`}
            bounds={bounds}
            padding={padding}
          />
        ) : (
          <Camera center={center} zoom={13.5} />
        )}
        {routeFeature ? (
          <GeoJSONSource id="ruta" data={routeFeature}>
            <Layer
              id="ruta-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.signBlue, 'line-width': 5 }}
            />
          </GeoJSONSource>
        ) : null}
        {paradas.map((parada) => {
          const favorite = parada.id === favoriteStopId;
          return (
            <Marker key={parada.id} lngLat={[parada.lng, parada.lat]} anchor="bottom">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favorite ? `${parada.nombre}, Mi paradero` : parada.nombre}
                accessibilityState={{ selected: selectedStopId === parada.id, disabled: !onSelectStop }}
                disabled={!onSelectStop}
                onPress={() => onSelectStop?.(parada)}
                style={styles.stopTarget}
              >
                <View
                  style={[
                    styles.stop,
                    favorite && styles.stopFavorite,
                    selectedStopId === parada.id && styles.stopSelected,
                  ]}
                >
                  {favorite ? <Icon name="star" color={colors.onYellow} size={20} />
                    : <Text style={styles.stopText}>{parada.orden}</Text>}
                </View>
              </Pressable>
            </Marker>
          );
        })}
        {vehiculos.map((vehiculo) => {
          const stale = isStale(vehiculo.timestamp_ultima_actualizacion, now);
          return (
            <Marker
              key={vehiculo.vehiculo_id}
              lngLat={[vehiculo.lng, vehiculo.lat]}
              anchor="center"
            >
              <View style={[styles.vehicle, stale && styles.vehicleStale]} />
            </Marker>
          );
        })}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  stopTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stopFavorite: {
    backgroundColor: colors.signYellow,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  stop: {
    width: 28,
    height: 28,
    borderRadius: radius.sign,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSelected: {
    transform: [{ scale: 1.15 }],
  },
  stopText: {
    color: colors.surface,
    fontFamily: fontFamily.display,
    fontSize: 15,
    lineHeight: 17,
    includeFontPadding: false,
  },
  vehicle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.signYellow,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  vehicleStale: {
    backgroundColor: colors.signRed,
  },
});
