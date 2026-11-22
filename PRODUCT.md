# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

- **Passengers** waiting at a stop or walking to one in Cúcuta, outdoors in strong sun, usually holding the phone with one hand. Their job: know whether the buseta already passed and when the next one arrives, to decide when to leave or keep waiting.
- **Drivers** of the pilot route who glance at the phone for a few seconds to start or end their shift and confirm their location is being shared. They must not handle the phone while driving.

## Product Purpose

Undergraduate thesis project (proyecto integrador): a pilot of one public transport route in Cúcuta that shows vehicles in real time and an ETA per stop, and measures whether that reduces waiting time. Success is defined by the user stories HU-01 to HU-07 in `docs/requerimientos_t_cnicos_app_rastreo_c_cuta.md` (status reflected within 15 s, GPS every 10 s or less with the screen locked, consent before transmitting, route and stops on the map, marker updates within 15 s, ETA error of 3 min or less, anonymous exportable wait log).

## Positioning

ETA is computed from the distance remaining along the route's own polyline and the vehicle's recent speed, not from static timetables or straight-line distance. The app also carries its own anonymous field-test instrumentation so the thesis hypothesis is measured on the device.

## Operating Context

- Passenger flow: map with route, stops and buses; per-stop ETA list; optional wait measurement for the study.
- Driver flow: data-treatment notice and consent, shift start/end, background location transmission, transmission test summary.
- Demo mode (default) simulates four buses on the approximate Directo Cúcuta route with no backend; Firebase mode uses Realtime Database and anonymous auth.

## Capabilities and Constraints

- Expo SDK 58, React Native, TypeScript, expo-router, MapLibre with an OpenStreetMap style, zustand, expo-sqlite.
- UI copy is Spanish (Colombia), neutral register.
- One app with two roles chosen at start; role can be switched from both flows.
- Stop states that must stay distinguishable: approaching with ETA, passed, stale data (no update for more than 30 s), no vehicles.

## Brand Commitments

Name: "Buseta Ya". The logo is a yellow painted-sign placard with an ink outline, a bus silhouette, and “YA” in Anton. No university branding.

## Evidence on Hand

- The Directo Cúcuta route in `src/data/seed.ts` was traced from the [Empresa Corta Distancia route-map screenshot](https://cortadistancia.com.co/?page_id=674) (accessed 2026-11-21) and snapped to OpenStreetMap streets with OSRM. The trace is approximate and the six team-selected reference stops are not official.
- No users, testimonials, ridership or performance figures exist. Never fabricate them.

## Product Principles

1. The ETA is the answer: it is the first thing a passenger reads on any stop.
2. Honest data: stale or simulated data is always labelled as such.
3. Glanceable for drivers: shift state is unmistakable in under two seconds.
4. Built for the street: legible in sunlight, operable with one thumb.

## Accessibility & Inclusion

Outdoor use in bright sun with one hand: high contrast (WCAG AA at least), large touch targets (48 dp minimum), states never conveyed by color alone.
