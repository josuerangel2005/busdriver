# Especificación Técnica para Agente de Desarrollo
**Proyecto:** Aplicación Móvil de Rastreo de Transporte Público (Cúcuta)
**Arquitectura:** Cliente-Servidor (Módulo Conductor -> Cloud -> Módulo Pasajero)

## 1. Pila Tecnológica (Tech Stack)
*   **Frontend (Móvil Multiplataforma):** React Native utilizando Expo.
*   **Lenguaje:** TypeScript.
*   **Backend / Servicios en la Nube:** Firebase (Realtime Database para actualizaciones de posición de baja latencia y Authentication).
*   **Servicio de Mapas:** Google Maps Platform (capa gratuita) o MapLibre/OpenStreetMap como alternativa.

## 2. Arquitectura del Sistema
El sistema se divide en tres componentes principales:
1.  **Módulo Conductor (App Móvil):** Instalada en el dispositivo del conductor. Captura la ubicación GPS y la transmite periódicamente en segundo plano a la nube.
2.  **Servicio en la Nube (Firebase):** Almacena el modelo estático (rutas, paradas) y el modelo dinámico (posiciones activas de los vehículos).
3.  **Módulo Pasajero (App Móvil):** Consulta las posiciones en tiempo real, dibuja los marcadores en un mapa interactivo y calcula/muestra el Tiempo Estimado de Llegada (ETA).

## 3. Historias de Usuario y Criterios de Aceptación (Backlog Inicial)

### Perfil Conductor
*   **HU-01 (Gestión de Turno):** Como conductor, quiero iniciar y finalizar mi turno para que los pasajeros me vean solo cuando estoy en servicio.
    *   *Criterio:* El estado «en servicio» debe reflejarse en la base de datos y en el mapa en 15 s o menos.
*   **HU-02 (Rastreo en Segundo Plano):** Como conductor, quiero que la app transmita mi posición en segundo plano para no manipular el teléfono mientras conduzco.
    *   *Criterio:* Transmisión exitosa del GPS cada 10 s o menos con la **pantalla bloqueada** durante una prueba continua de 30 min. (Nota técnica: requiere permisos nativos de background location en Expo).
*   **HU-03 (Tratamiento de Datos):** Como conductor, quiero aceptar el aviso de tratamiento de datos antes de transmitir para saber cómo se usa mi ubicación.
    *   *Criterio:* La aplicación bloquea la transmisión de ubicación hasta que exista un registro de aceptación en la base de datos.

### Perfil Pasajero
*   **HU-04 (Visualización de Ruta):** Como pasajero, quiero ver la ruta piloto y sus paradas para saber qué buseta me sirve.
    *   *Criterio:* El mapa renderiza un polyline de la ruta y los marcadores correspondientes a todas las paradas.
*   **HU-05 (Rastreo en Tiempo Real):** Como pasajero, quiero ver las busetas activas en tiempo real para saber si ya pasaron o si vienen en camino.
    *   *Criterio:* La posición del marcador del vehículo en el mapa del pasajero se actualiza en 15 s o menos respecto a la emisión original.
*   **HU-06 (Cálculo de ETA):** Como pasajero, quiero ver el tiempo estimado de llegada a mi paradero para decidir cuándo salir de casa.
    *   *Criterio:* ETA visible por cada paradero seleccionado. Error de precisión esperado en pruebas: <= 3 min. (Debe marcarse la posición como desactualizada si no se reciben datos recientes).

### Utilidad del Equipo
*   **HU-07 (Métricas de Estudio):** Como equipo, queremos registrar de forma anónima el tiempo de espera de cada prueba para medir la hipótesis.
    *   *Criterio:* Sistema para guardar un log (tiempo inicial, tiempo final, id de parada) exportable y anónimo.

## 4. Lógica de Negocio Crítica: Cálculo del ETA
El Tiempo Estimado de Llegada (ETA) de un vehículo $v$ a una parada $p$ no se basa en horarios estáticos, sino en la distancia restante a lo largo de la ruta y la velocidad reciente del tramo.

La fórmula matemática a implementar en la lógica de cliente (o mediante Cloud Functions) es:
$$ETA_{v,p} = \frac{d_{rest}(v,p)}{v_{tramo}}$$

**Variables:**
*   $d_{rest}(v,p)$: Distancia restante medida **sobre el trazado de la ruta** (Polyline), no en línea recta.
*   $v_{tramo}$: Velocidad promedio del vehículo en el tramo actual (calculada a partir de los deltas de las transmisiones de posición recientes).

## 5. Modelo de Datos Sugerido (Firebase Realtime DB)
Para iniciar la estructura en Firebase, el esquema base debe soportar:
*   `rutas/`: ID, nombre, coordenadas del trazado (polyline).
*   `paradas/`: ID, ruta_id, nombre, lat/lng, orden en la ruta.
*   `vehiculos_activos/`: 
    *   Clave: `vehiculo_id`
    *   Valores: `lat`, `lng`, `timestamp_ultima_actualizacion`, `ruta_activa`, `velocidad_actual`, `en_servicio (boolean)`.

## 6. Retos Técnicos para el Agente (Prioridades de Desarrollo)
1.  **Ubicación en Segundo Plano (Background Location):** Esta es la condición técnica más restrictiva. Debes configurar `expo-location` y `expo-task-manager` para asegurar que el sistema operativo no mate el proceso cuando la pantalla del conductor se apague.
2.  **Eficiencia de Lectura/Escritura:** Configurar la actualización de la Realtime Database para que ocurra en intervalos de 5 a 10 segundos, optimizando la cantidad de datos enviados para no exceder cuotas gratuitas.
3.  **Cálculo de Distancia sobre Ruta:** Debes implementar o usar una librería espacial (ej. turf.js) para proyectar la ubicación actual del GPS sobre la línea de la ruta (`snap to route`) y calcular la distancia $d_{rest}$ a lo largo de esa línea geométrica, no usando la fórmula de Haversine directa.