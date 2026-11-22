# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

- **Passengers** waiting at a stop or walking to one in Cúcuta, outdoors in strong sun, usually holding the phone with one hand. Their job: know whether the buseta already passed and when the next one arrives, to decide when to leave or keep waiting.
- **Drivers** on the three pilot lines who glance at the phone for a few seconds to start or end their shift and confirm their location is being shared. They must not handle the phone while driving.

## Product Purpose

Undergraduate thesis project (proyecto integrador): a pilot of three public transport lines in Cúcuta, each with two directions, that shows vehicles in real time and an ETA per stop, and measures whether that reduces waiting time. Success is defined by the user stories HU-01 to HU-07 in `docs/requerimientos_t_cnicos_app_rastreo_c_cuta.md` (status reflected within 15 s, GPS every 10 s or less with the screen locked, consent before transmitting, route and stops on the map, marker updates within 15 s, ETA error of 3 min or less, anonymous exportable wait log).

## Positioning

ETA is computed from the distance remaining along the route's own polyline and the vehicle's recent speed, not from static timetables or straight-line distance. The app also carries its own anonymous field-test instrumentation so the thesis hypothesis is measured on the device.

## Operating Context

- Passenger flow: map with saved line and direction selection, stops and buses; per-stop ETA list; optional wait measurement for the study.
- Driver flow: data-treatment notice and consent, line and direction selection before shift start, direction changes while stopped, shift end before switching lines, background location transmission, transmission test summary.
- Demo mode (default) simulates buses on the approximate Directo Cúcuta, Campo Verde and Natura routes in both directions with no backend; Firebase mode uses Realtime Database and anonymous auth.

## Capabilities and Constraints

- Expo SDK 58, React Native, TypeScript, expo-router, MapLibre with an OpenStreetMap style, zustand, expo-sqlite.
- UI copy is Spanish (Colombia), neutral register.
- One app with two roles chosen at start; role can be switched from both flows.
- Stop states that must stay distinguishable: approaching with ETA, passed, stale data (no update for more than 30 s), no vehicles.

## Brand Commitments

Name: "Buseta Ya". The logo is a yellow painted-sign placard with an ink outline, a bus silhouette, and “YA” in Anton. No university branding.

## Evidence on Hand

- The Directo Cúcuta route, loaded by `src/data/seed.ts` from `firebase/seed.json`, was traced from the [Empresa Corta Distancia route-map screenshot](https://cortadistancia.com.co/?page_id=674) (accessed 2026-11-21) and snapped to OpenStreetMap streets with OSRM. The trace is approximate and the six team-selected reference stops are not official.
- Campo Verde and Natura were traced from the same operator's route-map screenshots (accessed 2026-11-22), by placing waypoints on an OpenStreetMap basemap and routing along OSM streets with OSRM. All three lines share the Terminal → Autopista trunk. The operator does not publish the return alignment, so vuelta assumes the same streets in reverse. Stops on all three lines are unofficial reference points; the app labels the alignment “Trazado aproximado”.
- Published schedules: Directo Cúcuta, 5:30 a.m.–5:38 p.m. every 6–10 min; Campo Verde, 5:15 a.m.–6:40 p.m. every 15–20 min; Natura – Vista Hermosa, 5:30 a.m.–6:35 p.m. every 15–20 min.
- No users, testimonials, ridership or performance figures exist. Never fabricate them.

## Product Principles

1. The ETA is the answer: it is the first thing a passenger reads on any stop.
2. Honest data: stale or simulated data is always labelled as such.
3. Glanceable for drivers: shift state is unmistakable in under two seconds.
4. Built for the street: legible in sunlight, operable with one thumb.

## Accessibility & Inclusion

Outdoor use in bright sun with one hand: high contrast (WCAG AA at least), large touch targets (48 dp minimum), states never conveyed by color alone.
