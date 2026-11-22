# Admin route CRUD

Objective: let an admin user create, edit and deactivate routes inside the app. Branch: `feat/admin-route-crud` (from `feat/multi-route`). Delivery: ask-on-risk. Tests: `npx vitest run`; code is written with Codex (`codex exec`, inline worker).

## Specs

- S1 (user, 2026-11-22): "y como podríamos implementar una feature que permita a un usuario tipo admin , hacer un CRUD de rutas?" Agreed design: inside the app (not a web panel), in 3 parts.
- S2 Part 1, routes from Firebase: the app reads the route and stop catalog from the database, with a local cache and the bundled catalog as an offline fallback. Screens and the shift service stop importing the bundled catalog directly. Prerequisite for S3 and S4.
- S3 Part 2, secure admin: email/password sign-in with Firebase Auth, an `admins/<uid>` allowlist editable only from the console, and rules that let only admins write `rutas` and `paradas`. High risk: item 2 (security).
- S4 Part 3, CRUD screens: route list, an editor of waypoints snapped to streets (OSRM) plus stops, automatic return direction, and deactivate instead of delete (metrics and active shifts reference `ruta_id`).

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S2 | delegated (Codex, user request) | done | "feat: load the route catalog from Firebase…" |
| T2 | S3 | delegated (Codex) | pending | |
| T3 | S4 | delegated (Codex) | pending | |

## Log

- L1 (2026-11-22, user): "y como podríamos implementar una feature que permita a un usuario tipo admin , hacer un CRUD de rutas?"
- L2 (2026-11-22, user): "como cree que es mejor?" → recommendation: in-app, 3 parts. User: "si" (start part 1).
- L3: Finding. `RouteSelector.tsx`, `(passenger)/map.tsx`, `(driver)/shift.tsx`, `services/shift.ts` and `lib/routeSelection.ts` import `ROUTES`, `findRoute` and `PARADAS` from the bundled `src/data/seed.ts`, so routes added to Firebase would never appear.
- L4 (2026-11-22): T1 done. Codex added `src/lib/routeCatalog.ts` (pure helpers) and `src/stores/routeCatalog.ts` (load order AsyncStorage cache, then bundled seed, then remote Firebase; invalid remote entries dropped) and `Ruta.activa?`. Checks: vitest 79 passed, tsc passed, eslint 0 errors and 6 pre-existing warnings. Device (Motorola, release, Firebase mode): passenger opens with airplane mode on and shows Directo Cúcuta from the cache. Risk: none for T1 (read path only).
- L5 (2026-11-22, finding, out of T1 scope): with no connection the driver panel stays on "Verificando consentimiento…", because `getConsent` waits on Firebase. This bug predates T1. It goes on the pending "offline notice" item. Offline, the passenger shows "Sin unidades", which can mislead.
