import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminRouteMap } from '@/components/AdminRouteMap';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Placard } from '@/components/Placard';
import { Screen } from '@/components/Screen';
import { colors, font, fontFamily, radius, spacing } from '@/constants/theme';
import {
  buildLineUpdate, lineIdFor, lineRouteIds, orderStops, OSRM_FALLBACK,
  routeOnStreets, snapAdminStop, snapToTrace, validateLine, validName,
  type DraftStop,
} from '@/lib/adminLine';
import { findRoute, stopsFor } from '@/lib/routeCatalog';
import { getRepository } from '@/services/repository';
import { useAuthStore } from '@/stores/auth';
import { useRouteCatalog } from '@/stores/routeCatalog';
import type { LatLng, Ruta } from '@/types/models';

type Mode = 'trace' | 'stops';
type EditableStop = DraftStop & { key: number };
const OFFLINE_SAVE_MESSAGE = 'Sin conexión: no se puede guardar ahora.';

function isOffline() {
  return globalThis.navigator?.onLine === false;
}

function subscribeToConnectivity(notify: () => void) {
  globalThis.addEventListener?.('online', notify);
  globalThis.addEventListener?.('offline', notify);
  return () => {
    globalThis.removeEventListener?.('online', notify);
    globalThis.removeEventListener?.('offline', notify);
  };
}

type Notice = { label: string; tone: 'danger' | 'warning' | 'success' | 'neutral' };

export default function AdminLineScreen() {
  const { lineaId } = useLocalSearchParams<{ lineaId: string }>();
  const { ready, uid, role } = useAuthStore();
  const { catalog, ready: catalogReady } = useRouteCatalog();

  if (!ready) return <Screen />;
  if (role !== 'admin' || !uid) return <Redirect href="/" />;
  if (!catalogReady) return <Screen><Badge label="Cargando líneas…" /></Screen>;
  const ida = findRoute(catalog, lineRouteIds(lineaId)[0]);
  if (lineaId !== 'nueva' && !ida) {
    return (
      <Screen>
        <View style={styles.content}>
          <Badge label="No encontramos esta línea." tone="warning" />
          <Button label="Volver a las líneas" onPress={() => router.replace('/admin')} />
        </View>
      </Screen>
    );
  }
  // An existing draft must be reseeded from server stops before it can be saved.
  return <LineEditor key={lineaId === 'nueva' ? lineaId : `${lineaId}:${catalog.source === 'remote'}`} ida={lineaId === 'nueva' ? undefined : ida} />;
}

function LineEditor({ ida }: { ida?: Ruta }) {
  const catalog = useRouteCatalog((state) => state.catalog);
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState(ida?.linea_nombre ?? '');
  const [mode, setMode] = useState<Mode>(ida ? 'stops' : 'trace');
  const [waypoints, setWaypoints] = useState<LatLng[] | undefined>(() =>
    Array.isArray(ida?.waypoints) && ida.waypoints.length >= 2 ? ida.waypoints : ida ? undefined : []);
  const [initialPolyline] = useState(ida?.polyline);
  const [polyline, setPolyline] = useState<LatLng[]>(ida?.polyline ?? []);
  const [undoTrace, setUndoTrace] = useState<{ waypoints?: LatLng[]; polyline: LatLng[] }[]>([]);
  const [stops, setStops] = useState<EditableStop[]>(() => {
    if (!ida) return [];
    const reversed = stopsFor(catalog, lineRouteIds(ida.linea_id)[1]).reverse();
    return stopsFor(catalog, ida.id).map((stop, key) => {
      const point = { latitude: stop.lat, longitude: stop.lng };
      return {
        key, point, name: stop.nombre, alongKm: snapToTrace(ida.polyline, point).alongKm,
        idaId: stop.id, vueltaId: reversed[key]?.id,
      };
    });
  });
  const nextStop = useRef(stops.length);
  const [pendingStop, setPendingStop] = useState<LatLng | null>(null);
  const [stopName, setStopName] = useState('');
  const [vehiclesInService, setVehiclesInService] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'adjust' | null>(null);
  const locked = busy !== null;
  const waitingForCatalog = catalog.source !== 'remote';
  const offline = useSyncExternalStore(subscribeToConnectivity, isOffline, () => false);
  const lineId = ida?.linea_id;

  useEffect(() => {
    if (!lineId) return;
    const ids = new Set<string>(lineRouteIds(lineId));
    return getRepository().subscribeVehicles((vehicles) => {
      setVehiclesInService(vehicles.filter((vehicle) => vehicle.en_servicio && ids.has(vehicle.ruta_activa)).length);
    });
  }, [lineId]);

  const traceChanged = polyline !== initialPolyline;
  const orderedStops = orderStops(stops.map((stop) => {
    if (!traceChanged || polyline.length < 2) return { ...stop, offTrace: false };
    const snapped = snapToTrace(polyline, stop.point);
    const offTrace = snapped.distanceToRouteKm > 0.15;
    return { ...stop, alongKm: snapped.alongKm, point: offTrace ? stop.point : snapped.location, offTrace };
  }));

  function changeTrace(points: LatLng[]) {
    setUndoTrace((history) => [...history, { waypoints, polyline }]);
    setWaypoints(points);
    setPolyline(points);
    setNotice(null);
  }

  function undo() {
    const previous = undoTrace.at(-1);
    if (!previous) return;
    setUndoTrace(undoTrace.slice(0, -1));
    setWaypoints(previous.waypoints);
    setPolyline(previous.polyline);
    setNotice(null);
  }

  function selectMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setPendingStop(null);
    setStopName('');
  }

  function tap(point: LatLng) {
    if (locked) return;
    if (mode === 'trace') {
      if (!waypoints) return;
      changeTrace([...waypoints, point]);
      return;
    }
    if (pendingStop) return;
    const snapped = snapAdminStop(polyline, point);
    if (!snapped) {
      setNotice({
        tone: 'warning',
        label: polyline.length < 2 ? 'Define el trazado antes de agregar paraderos.'
          : 'El punto está a más de 150 m del trazado. Toca más cerca de la línea.',
      });
      return;
    }
    setPendingStop(snapped.location);
    setStopName('');
    setNotice(null);
  }

  function addStop() {
    if (!pendingStop) return;
    if (!validName(stopName)) {
      setNotice({ tone: 'warning', label: 'Escribe un nombre de 1 a 80 caracteres para el paradero.' });
      return;
    }
    const key = nextStop.current++;
    const alongKm = snapToTrace(polyline, pendingStop).alongKm;
    setStops((current) => [...current, { key, point: pendingStop, name: stopName.trim(), alongKm }]);
    setPendingStop(null);
    setNotice(null);
  }

  async function adjust() {
    if (!waypoints || waypoints.length < 2) return;
    setBusy('adjust');
    setNotice(null);
    try {
      const result = await routeOnStreets(waypoints);
      setPolyline(result.polyline);
      setNotice(result.adjusted
        ? { tone: 'success', label: 'Trazado ajustado a las calles.' }
        : { tone: 'warning', label: OSRM_FALLBACK });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (waitingForCatalog || useRouteCatalog.getState().catalog.source !== 'remote') return;
    if (isOffline()) {
      setSaveError(OFFLINE_SAVE_MESSAGE);
      return;
    }
    const id = lineId ?? lineIdFor(name, catalog.routes.map((route) => route.linea_id));
    const [idaId, vueltaId] = lineRouteIds(id);
    const currentIda = findRoute(catalog, idaId);
    const currentVuelta = findRoute(catalog, vueltaId);
    const draft = {
      lineId: id, name, active: (currentIda ?? ida)?.activa !== false,
      returnActive: currentVuelta ? currentVuelta.activa !== false : undefined,
      polyline, waypoints, stops: orderedStops,
    };
    const error = validateLine(draft) ?? (orderedStops.some((stop) => stop.offTrace)
      ? 'Retira los paraderos alejados del trazado y vuelve a ubicarlos sobre la línea.' : null);
    if (error) {
      setSaveError(error);
      return;
    }
    setBusy('save');
    setSaveError(null);
    try {
      const previousStops = id === lineId ? [...stopsFor(catalog, idaId), ...stopsFor(catalog, vueltaId)] : [];
      await getRepository().saveLine(buildLineUpdate(draft, previousStops));
      Alert.alert('Línea guardada', 'Se actualizaron los dos sentidos.', [
        { text: 'Aceptar', onPress: () => router.canGoBack() ? router.back() : router.replace('/admin') },
      ], { cancelable: false });
    } catch (error) {
      setSaveError(error instanceof Error && /disconnected|client is offline|network error/i.test(error.message)
        ? OFFLINE_SAVE_MESSAGE
        : 'No pudimos guardar la línea. Inténtalo de nuevo.');
      setBusy(null);
    }
  }

  const mapMarkers = mode === 'trace'
    ? (waypoints ?? []).map((point, id) => ({ id, point }))
    : orderedStops.map(({ key, point }) => ({ id: key, point }));
  const markers = mode === 'stops' && pendingStop
    ? [...mapMarkers, { id: -1, point: pendingStop }]
    : mapMarkers;

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]}
      >
        <Text accessibilityRole="header" style={styles.title}>{ida ? 'Editar línea' : 'Nueva línea'}</Text>
        {vehiclesInService > 0 && (
          <Badge tone="warning" label={`Hay ${vehiclesInService} buses en servicio en esta línea. Los cambios se verán de inmediato.`} />
        )}
        <Text style={styles.label}>Nombre de la línea</Text>
        <TextInput
          accessibilityLabel="Nombre de la línea"
          style={styles.input}
          value={name}
          onChangeText={setName}
          editable={!locked}
          maxLength={80}
        />
        <View style={styles.segments} accessibilityRole="tablist">
          {(['trace', 'stops'] as const).map((value) => {
            const selected = value === mode;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected, disabled: locked }}
                disabled={locked}
                onPress={() => selectMode(value)}
                style={[styles.segment, selected && styles.selected]}
              >
                <Icon name={value === 'trace' ? 'map-marker-path' : 'map-marker'} color={selected ? colors.surface : colors.ink} />
                <Text style={[styles.label, styles.segmentText, selected && styles.selectedText]}>{value === 'trace' ? 'Trazado' : 'Paraderos'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.note}>
          {mode === 'stops' ? 'Toca cerca de la línea para ubicar un paradero.'
            : waypoints ? 'Toca el mapa para agregar puntos en el orden del recorrido de ida.'
              : 'Puedes conservar el trazado actual o rehacerlo.'}
        </Text>
        <AdminRouteMap polyline={polyline} markers={markers} mode={mode} onTap={tap} />
        {notice && (
          <View accessibilityLiveRegion="polite">
            <Badge {...notice} />
          </View>
        )}
        {mode === 'trace' ? (
          <Placard tone="plain">
            <View style={styles.group}>
              <Text accessibilityRole="header" style={styles.heading}>Trazado de ida</Text>
              {waypoints ? (
                <>
                  <Button label="Ajustar a las calles" loading={busy === 'adjust'} disabled={locked || waypoints.length < 2} onPress={() => void adjust()} />
                  <Button label="Deshacer" variant="secondary" disabled={locked || undoTrace.length === 0} onPress={undo} />
                  {waypoints.map((point, index) => (
                    <View key={index} style={styles.row}>
                      <Text style={styles.note}>Punto {index + 1}: {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
                      <Button label={`Quitar punto ${index + 1}`} variant="secondary" disabled={locked} onPress={() => changeTrace(waypoints.filter((_, i) => i !== index))} />
                    </View>
                  ))}
                </>
              ) : (
                <Button label="Rehacer trazado" variant="secondary" disabled={locked} onPress={() => changeTrace([])} />
              )}
            </View>
          </Placard>
        ) : (
          <Placard tone="plain">
            <View style={styles.group}>
              <Text accessibilityRole="header" style={styles.heading}>Paraderos de ida</Text>
              {pendingStop && (
                <View style={styles.group}>
                  <Text style={styles.label}>Nombre del nuevo paradero</Text>
                  <TextInput
                    accessibilityLabel="Nombre del nuevo paradero"
                    style={styles.input}
                    value={stopName}
                    onChangeText={setStopName}
                    maxLength={80}
                    onSubmitEditing={addStop}
                  />
                  <Button label="Agregar paradero" onPress={addStop} />
                  <Button label="Cancelar paradero" variant="secondary" onPress={() => { setPendingStop(null); setNotice(null); }} />
                </View>
              )}
              {orderedStops.length === 0 && !pendingStop && <Badge label="Aún no hay paraderos." />}
              {orderedStops.map((stop, index) => (
                <View key={stop.key} style={styles.row}>
                  <Text style={styles.label}>Paradero {index + 1}</Text>
                  {stop.offTrace && <Badge tone="warning" label="Fuera del trazado" />}
                  <TextInput
                    accessibilityLabel={`Nombre del paradero ${index + 1}`}
                    style={styles.input}
                    value={stop.name}
                    editable={!locked}
                    maxLength={80}
                    onChangeText={(text) => setStops((current) => current.map((item) => item.key === stop.key ? { ...item, name: text } : item))}
                  />
                  <Button label={`Quitar paradero ${index + 1}`} variant="secondary" disabled={locked} onPress={() => setStops((current) => current.filter((item) => item.key !== stop.key))} />
                </View>
              ))}
            </View>
          </Placard>
        )}
        {(waitingForCatalog || offline) && (
          <View accessibilityLiveRegion="polite">
            <Badge tone="warning" label={offline ? OFFLINE_SAVE_MESSAGE : 'Esperando las rutas del servidor para guardar sin perder datos…'} />
          </View>
        )}
        {saveError && !waitingForCatalog && !offline && (
          <View accessibilityLiveRegion="polite">
            <Badge label={saveError} tone="danger" />
          </View>
        )}
        <Button label="Guardar" loading={busy === 'save'} disabled={locked || waitingForCatalog || offline || pendingStop !== null} onPress={() => void save()} />
        <Button label="Volver a las líneas" variant="secondary" disabled={locked} onPress={() => router.canGoBack() ? router.back() : router.replace('/admin')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.md },
  title: { color: colors.ink, fontFamily: fontFamily.display, fontSize: font.headline },
  heading: { color: colors.ink, fontSize: font.title, fontWeight: '700' },
  label: { color: colors.ink, fontSize: font.body, fontWeight: '700' },
  note: { color: colors.inkMuted, fontSize: font.body },
  input: {
    minHeight: 48, color: colors.ink, fontSize: font.body, backgroundColor: colors.surface,
    borderColor: colors.ink, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: spacing.sm,
  },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1, flexDirection: 'row', gap: spacing.xs, padding: spacing.xs, minHeight: 48, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: radius.control,
  },
  selected: { backgroundColor: colors.ink },
  segmentText: { flexShrink: 1 },
  selectedText: { color: colors.surface },
  group: { gap: spacing.sm },
  row: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkMuted },
});
