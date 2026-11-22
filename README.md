# Buseta Ya

App móvil de rastreo de transporte público para Cúcuta. Una sola app Expo con
selección de rol:

- **Conductor**: acepta el aviso de tratamiento de datos, elige línea y sentido antes de
  iniciar el turno y transmite su ubicación en segundo plano. Puede cambiar de
  sentido con el vehículo detenido; para cambiar de línea debe finalizar el turno.
- **Pasajero**: elige línea y sentido, y ve su trazado aproximado, paradas, vehículos en
  servicio y tiempos estimados de llegada (ETA). La selección se guarda en el dispositivo.

Stack: Expo SDK 58 + TypeScript + expo-router, MapLibre + OpenStreetMap,
Firebase (Auth anónima + Realtime Database), expo-location + expo-task-manager,
@turf/* para geometría, zustand, expo-sqlite para métricas locales.

## Requisitos

- Node 20+ y npm.
- Un development build de la app (**Expo Go no sirve**): la ubicación en
  segundo plano requiere módulos nativos.
- Opcional: proyecto Firebase si vas a usar datos reales.

## Puesta en marcha (modo simulado)

El modo simulado no necesita Firebase: las busetas recorren las tres líneas, alternan
ida y vuelta al llegar a cada terminal y actualizan su posición cada 3 segundos.
La separación inicial aproxima 8 min en Directo Cúcuta y 17 min en Campo Verde y Natura. La buseta `demo-buseta-3` pierde la señal
45 s cada 3 min para que se vea el estado **desactualizado** durante más tiempo
que el umbral de 30 s. En este modo, el conductor **no** usa el GPS del teléfono: al iniciar el turno la
buseta se mueve sola por la ruta. Con el modo simulado activo (cualquier valor
distinto de `false` en `EXPO_PUBLIC_USE_MOCK`) los plugins de React Native
Firebase se omiten automáticamente en la configuración de Expo, por lo que **no
necesitas `google-services.json` ni `GoogleService-Info.plist`** para compilar.

```bash
npm install
cp env.example .env      # EXPO_PUBLIC_USE_MOCK=true
npx expo run:android     # o npx expo run:ios
```

Para generar el build nativo en la nube:

```bash
npx eas build --profile development --platform android
```

### Versión de Kotlin en Android

El build de Android fija `android.kotlinVersion` en `2.3.21` dentro del plugin
`expo-build-properties` de `app.json`. Firebase Auth 25 se compila con Kotlin 2.4,
cuya metadata rechaza el compilador por defecto de Expo (2.2), y el
`pika-compiler` de Expo todavía no tiene una versión 2.4.21. Puedes quitar ese
pin cuando el Kotlin por defecto de Expo lea metadata 2.4.

## Puesta en marcha con Firebase

1. Crea un proyecto en la consola de Firebase.
2. Habilita **Authentication → Anónimo**.
3. Crea una **Realtime Database** y publica las reglas de
   `firebase/database.rules.json`.
4. Importa `firebase/seed.json` en la Realtime Database (consola → menú ⋮ →
   Importar JSON). Si ya usabas el catálogo anterior, debes volver a importar el
   nuevo `firebase/seed.json` antes de usar esta versión. Finaliza los turnos
   activos y respalda la base: actualiza solo `rutas` y `paradas` desde el
   archivo si necesitas conservar los demás nodos.
5. Descarga `google-services.json` (Android) y `GoogleService-Info.plist`
   (iOS) en la raíz del proyecto.
6. En `.env` coloca `EXPO_PUBLIC_USE_MOCK=false`.
7. Vuelve a compilar el development build.

Para los builds de EAS también debes definir `EXPO_PUBLIC_USE_MOCK=false` en el
entorno de EAS (variables de entorno del proyecto o el bloque `env` de
`eas.json`), porque EAS no sube el archivo `.env`. Sin esa variable el build
usaría el modo simulado y omitiría Firebase.

> `google-services.json` (Android) y `GoogleService-Info.plist` (iOS) deben
> existir en la raíz del proyecto antes de compilar con
> `EXPO_PUBLIC_USE_MOCK=false`; sin ellos el build nativo falla.

### Habilitar una cuenta de administrador

1. En **Authentication → Método de acceso**, habilita **Correo electrónico/contraseña**.
2. En **Authentication → Usuarios**, crea el usuario y copia su UID.
3. En **Realtime Database → Datos**, agrega `admins/<uid>: true` como valor
   booleano, no como texto.
4. En **Realtime Database → Reglas**, vuelve a publicar `firebase/database.rules.json`.
   En la app, selecciona **Soy administrador** e inicia sesión con esa cuenta.

Solo un operador autorizado de la consola puede conceder o revocar el acceso:
la app no puede escribir en `admins` y cada usuario solo puede leer su propia entrada.

Las reglas de paradas consultan el catálogo resultante con
`newData.parent().parent()`, no el estado anterior con `root`. Así una
actualización multipath puede crear una ruta y sus paradas juntas, pero no
escribir una parada que apunta a una ruta eliminada en esa misma operación.
### Administrar líneas

1. En **Administración**, selecciona **Nueva línea** o **Editar**.
2. En **Trazado**, toca el mapa en el orden del recorrido de ida. Opcionalmente,
   selecciona **Ajustar a las calles**. Si solo necesitas editar paraderos de
   una línea existente, conserva su trazado.
3. En **Paraderos**, toca cerca del trazado y nombra al menos dos paraderos.
   La app los ubica sobre la línea y los ordena según el recorrido.
4. Selecciona **Guardar**. La app genera la vuelta en orden inverso y guarda los
   dos sentidos y sus paraderos en una sola actualización.

**Desactivar línea** oculta ambos sentidos a pasajeros y conductores sin
eliminar rutas ni romper las referencias de turnos o métricas. Usa
**Activar línea** para volver a mostrarlos.

**Ajustar a las calles** envía los puntos al servicio público de OSRM y
requiere internet. Si el servicio falla o no responde en 10 segundos, la app
avisa y conserva los segmentos rectos. El modo demo guarda los cambios en
memoria; al reiniciar la app se restaura el catálogo original.

**Antes de usar el editor con Firebase:** vuelve a publicar
`firebase/database.rules.json` para habilitar los puntos de trazado y
aplicar las nuevas validaciones.

## Comandos

| Comando             | Qué hace                                  |
| ------------------- | ----------------------------------------- |
| `npm start`         | Metro + dev client                        |
| `npm run android`   | Compila y ejecuta en Android              |
| `npm run ios`       | Compila y ejecuta en iOS                  |
| `npm test`          | Pruebas unitarias de ETA, geometría, turnos y métricas de campo |
| `npm run typecheck` | Verificación de tipos                     |
| `npm run lint`      | ESLint                                    |

## Estructura

```
src/
  app/                 rutas de expo-router
    admin/             ingreso, catálogo y editor de líneas
    (driver)/          consentimiento y turno
    (passenger)/       mapa y detalle de ETA
  components/          Screen, Button, Badge, RouteMap, EtaCard
  constants/           configuración y tema
  data/                trazado aproximado y paradas de referencia
  hooks/               suscripción a datos de ruta
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

## Pruebas de campo

La app registra en el dispositivo las mediciones necesarias para demostrar los
criterios de aceptación de las HU-02, HU-05 y HU-06. Todo se guarda en la base
local `metricas.db` y se exporta como CSV desde la propia app.

### Prueba de 30 minutos con pantalla bloqueada (HU-02)

1. En el teléfono del conductor, inicia sesión como conductor y otorga el
   permiso de ubicación "Permitir todo el tiempo".
2. Inicia el turno y bloquea la pantalla.
3. Mantén la prueba durante 30 minutos continuos (puedes moverte por la ruta).
4. Al terminar, desbloquea el teléfono y vuelve al panel del conductor.
5. La tarjeta **Prueba de transmisión** muestra el total de pings, los fallidos,
   la duración, el intervalo máximo y el porcentaje de intervalos ≤ 10 s.
6. Usa **Exportar pings CSV** para guardar la evidencia.

En Android, la app solicita ubicaciones cada 8 s (`UPDATE_INTERVAL_MS`) para
dar margen a los retrasos de entrega. La meta no cambia: cada intervalo entre
pings exitosos debe ser ≤ 10 s (`PING_TARGET_MS`) durante al menos 30 minutos
continuos.

### Latencia del marcador (HU-05)

Cada vez que el teléfono del pasajero recibe una nueva emisión de posición, la
app registra la diferencia entre `timestamp_ultima_actualizacion` y la hora de
recepción. En la pantalla de ETA, la tarjeta **Pruebas de campo** muestra el
promedio, el máximo y el porcentaje de latencias ≤ 15 s (`LATENCY_TARGET_MS`).
Usa **Exportar latencias CSV** para guardar la evidencia.

> La latencia depende de que ambos teléfonos tengan el reloj sincronizado. Deja
> activada la hora automática por red en los dos dispositivos.

### Error del ETA (HU-06 / HU-07)

1. Selecciona una parada y pulsa **Iniciar medición**; la app guarda el ETA que
   se mostraba en ese momento y el vehículo asociado.
2. Cuando el vehículo llegue de verdad a la parada, pulsa **Finalizar medición**.
3. La app guarda el tiempo real y calcula el error absoluto contra la predicción.

La tarjeta **Pruebas de campo** muestra el promedio, el máximo y el porcentaje de
errores ≤ 3 min (`ETA_ERROR_TARGET_S`). Usa **Exportar pruebas ETA CSV**.

### Contenido de los CSV

| Archivo       | Columnas                                                                   |
| ------------- | -------------------------------------------------------------------------- |
| Pings         | `id`, `vehiculo_id`, `timestamp_gps_iso`, `enviado_en_iso`, `ok`, `error`   |
| Latencias     | `id`, `vehiculo_id`, `timestamp_emision_iso`, `recibido_en_iso`, `latencia_ms` |
| Pruebas ETA   | `id`, `parada_id`, `vehiculo_id`, `inicio_iso`, `llegada_iso`, `eta_predicha_s` |
| Esperas       | `id`, `parada_id`, `inicio_iso`, `fin_iso`, `duracion_ms`                  |

Metas: pings ≤ 10 s, latencia ≤ 15 s, error de ETA ≤ 3 min. El botón
**Borrar registros de prueba** del panel del conductor elimina pings, latencias
y pruebas de ETA de este dispositivo; no borra las mediciones de espera.

## Fuente de los datos de la ruta

El trazado aproximado de **Directo Cúcuta** (unos 11,7 km) va de la Terminal de
Transportes a La Parada por el centro, San Mateo, la Autopista Internacional y
Villa del Rosario. El equipo lo digitalizó a partir de la captura del mapa
publicada por [Empresa Corta Distancia](https://cortadistancia.com.co/?page_id=674)
(consulta del 21 de noviembre de 2026) y lo ajustó a las vías de OpenStreetMap
con OSRM. Las seis paradas son puntos de referencia aproximados elegidos por el
equipo, no paradas oficiales.

El operador publica un primer turno a las 5:30 a. m., una frecuencia de 6 a 10
minutos y un último turno a las 5:38 p. m.

**Campo Verde** y **Natura** (publicada como **Natura – Vista Hermosa**) se
digitalizaron a partir de las capturas de mapas del mismo operador (consulta
del 22 de noviembre de 2026). Se ubicaron puntos de paso en un mapa base de
OpenStreetMap y se trazaron los recorridos sobre sus calles con OSRM. Las tres
líneas comparten el tramo Terminal → Autopista. El operador no publica el
recorrido de vuelta: se modela por las mismas calles en sentido inverso.
Todas las paradas son referencias no oficiales.

| Línea | Primer turno | Último turno | Frecuencia publicada |
| --- | --- | --- | --- |
| Directo Cúcuta | 5:30 a. m. | 5:38 p. m. | 6–10 min |
| Campo Verde | 5:15 a. m. | 6:40 p. m. | 15–20 min |
| Natura – Vista Hermosa | 5:30 a. m. | 6:35 p. m. | 15–20 min |

## Limitaciones conocidas

- El trazado no es una geometría oficial y las paradas no están validadas por
  el operador.
- El estilo de mapa por defecto es **OpenFreeMap Liberty** (OpenStreetMap, sin
  API key); puedes cambiarlo con `EXPO_PUBLIC_MAP_STYLE_URL`.
- Las métricas se guardan localmente en SQLite; el CSV se comparte desde el
  dispositivo y no incluye datos personales.

## Catálogo de rutas sin conexión

En modo Firebase, la app lee las rutas de `rutas` y las paradas de `paradas`.
Al iniciar, usa la última copia válida guardada en el dispositivo o, si no existe,
el catálogo incluido en la app. Cuando llega un catálogo válido de Firebase, la
app actualiza la copia local. Las rutas inactivas no aparecen en los selectores.
El modo simulado siempre usa el catálogo incluido.
