import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/config';
import { colors, font } from '@/constants/theme';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

type Props = {
  ruta: Ruta | null;
  paradas: Parada[];
  vehiculos: VehiculoActivo[];
  selectedStopId?: string | null;
  onSelectStop?: (parada: Parada) => void;
};

const DEFAULT_CENTER: [number, number] = [-72.5008, 7.898];

export function RouteMap({
  ruta,
  paradas,
  vehiculos,
  selectedStopId,
  onSelectStop,
}: Props) {
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
      <Map mapStyle={MAP_STYLE_URL} style={styles.map}>
        <Camera center={center} zoom={13.5} />
        {routeFeature ? (
          <GeoJSONSource id="ruta" data={routeFeature}>
            <Layer
              id="ruta-linea"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.primary, 'line-width': 5 }}
            />
          </GeoJSONSource>
        ) : null}
        {paradas.map((parada) => (
          <Marker key={parada.id} lngLat={[parada.lng, parada.lat]} anchor="bottom">
            <Pressable onPress={() => onSelectStop?.(parada)} hitSlop={8}>
              <View
                style={[
                  styles.stop,
                  selectedStopId === parada.id && styles.stopSelected,
                ]}
              >
                <Text style={styles.stopText}>{parada.orden}</Text>
              </View>
            </Pressable>
          </Marker>
        ))}
        {vehiculos.map((vehiculo) => (
          <Marker
            key={vehiculo.vehiculo_id}
            lngLat={[vehiculo.lng, vehiculo.lat]}
            anchor="center"
          >
            <View style={styles.vehicle}>
              <View style={styles.vehicleCore} />
            </View>
          </Marker>
        ))}
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
  stop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.marker,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSelected: {
    backgroundColor: colors.primary,
    transform: [{ scale: 1.15 }],
  },
  stopText: {
    color: colors.surface,
    fontSize: font.sm,
    fontWeight: '700',
  },
  vehicle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: `${colors.success}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
