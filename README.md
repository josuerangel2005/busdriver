# Rastreo Cúcuta

App móvil de rastreo de transporte público para Cúcuta. Una sola app Expo con
selección de rol:

- **Conductor**: acepta el aviso de tratamiento de datos, inicia/termina turno y
  transmite su ubicación en segundo plano.
- **Pasajero**: ve la ruta piloto, las paradas, los vehículos en servicio y el
  tiempo estimado de llegada (ETA) por parada.

Stack: Expo SDK 58 + TypeScript + expo-router, MapLibre + OpenStreetMap,
Firebase (Auth anónima + Realtime Database), expo-location + expo-task-manager,
@turf/* para geometría, zustand, expo-sqlite para métricas locales.

## Requisitos

- Node 20+ y npm.
- Un development build de la app (**Expo Go no sirve**): la ubicación en
  segundo plano requiere módulos nativos.
- Opcional: proyecto Firebase si vas a usar datos reales.

## Puesta en marcha (modo simulado)

El modo simulado no necesita Firebase: un vehículo recorre la ruta piloto cada
3 segundos.

```bash
npm install
cp env.example .env      # EXPO_PUBLIC_USE_MOCK=true
npx expo run:android     # o npx expo run:ios
```

Para generar el build nativo en la nube:

```bash
npx eas build --profile development --platform android
```

## Puesta en marcha con Firebase

1. Crea un proyecto en la consola de Firebase.
2. Habilita **Authentication → Anónimo**.
3. Crea una **Realtime Database** y publica las reglas de
   `firebase/database.rules.json`.
4. Importa `firebase/seed.json` en la Realtime Database (consola → menú ⋮ →
   Importar JSON).
5. Descarga `google-services.json` (Android) y `GoogleService-Info.plist`
   (iOS) en la raíz del proyecto.
6. En `.env` coloca `EXPO_PUBLIC_USE_MOCK=false`.
7. Vuelve a compilar el development build.

## Comandos

| Comando             | Qué hace                                  |
| ------------------- | ----------------------------------------- |
| `npm start`         | Metro + dev client                        |
| `npm run android`   | Compila y ejecuta en Android              |
| `npm run ios`       | Compila y ejecuta en iOS                  |
| `npm test`          | Pruebas unitarias de ETA y geometría      |
| `npm run typecheck` | Verificación de tipos                     |
| `npm run lint`      | ESLint                                    |

## Estructura

```
src/
  app/                 rutas de expo-router
    (driver)/          consentimiento y turno
    (passenger)/       mapa y detalle de ETA
  components/          Screen, Button, Badge, RouteMap, EtaCard
  constants/           configuración y tema
  data/                ruta y paradas placeholder
  hooks/               suscripción a datos del piloto
  lib/                 geometría, ETA y métricas SQLite
  services/            repositorio (mock y Firebase), tracking
  stores/              zustand (auth, tracking)
  tasks/               tarea de ubicación en segundo plano
tests/                 pruebas unitarias (vitest)
firebase/              reglas y datos semilla
```

## Modelo de datos (Realtime Database)

- `rutas/{rutaId}`: `nombre`, `polyline` (lista de `{latitude, longitude}`).
- `paradas/{paradaId}`: `ruta_id`, `nombre`, `lat`, `lng`, `orden`.
- `vehiculos_activos/{vehiculoId}`: `lat`, `lng`,
  `timestamp_ultima_actualizacion`, `ruta_activa`, `velocidad_actual`,
  `en_servicio`.
- `usuarios/{uid}/consentimiento`: `aceptado`, `version`, `timestamp`.
- `metricas/{metricaId}`: `parada_id`, `inicio`, `fin`, `duracion_ms`.

No se guarda historial de posiciones: la velocidad se calcula en el dispositivo
y se envía como `velocidad_actual`.

## Lógica del ETA

1. Se ajusta (snap) la posición del vehículo y de cada parada a la polilínea de
   la ruta con `@turf/nearest-point-on-line`.
2. La distancia restante se mide **a lo largo de la ruta**, no en línea recta.
3. `ETA = distancia_restante / velocidad`, con velocidad efectiva mínima de
   5.5 m/s cuando el vehículo está detenido.
4. Si la última posición tiene más de 30 s, la parada se marca como
   desactualizada y no se muestra ETA.

## Criterios de aceptación

- **HU-01**: el estado "en servicio" se refleja en la base de datos y en el mapa
  en ≤ 15 s.
- **HU-02**: transmisión cada 10 s con pantalla bloqueada durante 30 minutos.
- **HU-03**: sin consentimiento guardado no se inicia la transmisión.
- **HU-04**: el mapa dibuja la polilínea y todas las paradas.
- **HU-05**: el marcador del vehículo se actualiza en ≤ 15 s.
- **HU-06**: ETA visible por parada, error ≤ 3 min en pruebas y aviso de datos
  desactualizados.
- **HU-07**: registro anónimo de espera (inicio, fin, parada) exportable a CSV.

## Limitaciones conocidas

- La ruta y las paradas son **placeholder** hasta cargar el trazado real.
- El estilo de mapa por defecto es el demo público de MapLibre; para producción
  usa un proveedor de tiles vectoriales.
- Las métricas se guardan localmente en SQLite; el CSV se comparte desde el
  dispositivo y no incluye datos personales.
