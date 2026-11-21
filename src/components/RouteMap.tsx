import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/config';
import { colors, fontFamily, radius } from '@/constants/theme';
import { isStale } from '@/lib/eta';
import type { Parada, Ruta, VehiculoActivo } from '@/types/models';

type Props = {
  ruta: Ruta | null;
  paradas: Parada[];
  vehiculos: VehiculoActivo[];
  selectedStopId?: string | null;
  onSelectStop?: (parada: Parada) => void;
  now: number;
};

const DEFAULT_CENTER: [number, number] = [-72.5008, 7.898];

export function RouteMap({
  ruta,
  paradas,
  vehiculos,
  selectedStopId,
  onSelectStop,
  now,
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
              paint={{ 'line-color': colors.signBlue, 'line-width': 5 }}
            />
          </GeoJSONSource>
        ) : null}
        {paradas.map((parada) => (
          <Marker key={parada.id} lngLat={[parada.lng, parada.lat]} anchor="bottom">
            <Pressable onPress={() => onSelectStop?.(parada)} hitSlop={10}>
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
