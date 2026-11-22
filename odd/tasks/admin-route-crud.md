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
| T2 | S3 | delegated (Codex) + independent verifier (high risk item 2) | done (rules unverified on emulator) | "feat: add a secure admin role…" |
| T3 | S4 | delegated (Codex) + independent verifier (high risk items 1, 2) | done in code; device write test pending rules publish | "feat: let admins create, edit and deactivate lines…" |

## Log

- L1 (2026-11-22, user): "y como podríamos implementar una feature que permita a un usuario tipo admin , hacer un CRUD de rutas?"
- L2 (2026-11-22, user): "como cree que es mejor?" → recommendation: in-app, 3 parts. User: "si" (start part 1).
- L3: Finding. `RouteSelector.tsx`, `(passenger)/map.tsx`, `(driver)/shift.tsx`, `services/shift.ts` and `lib/routeSelection.ts` import `ROUTES`, `findRoute` and `PARADAS` from the bundled `src/data/seed.ts`, so routes added to Firebase would never appear.
- L4 (2026-11-22): T1 done. Codex added `src/lib/routeCatalog.ts` (pure helpers) and `src/stores/routeCatalog.ts` (load order AsyncStorage cache, then bundled seed, then remote Firebase; invalid remote entries dropped) and `Ruta.activa?`. Checks: vitest 79 passed, tsc passed, eslint 0 errors and 6 pre-existing warnings. Device (Motorola, release, Firebase mode): passenger opens with airplane mode on and shows Directo Cúcuta from the cache. Risk: none for T1 (read path only).
- L5 (2026-11-22, finding, out of T1 scope): with no connection the driver panel stays on "Verificando consentimiento…", because `getConsent` waits on Firebase. This bug predates T1. It goes on the pending "offline notice" item. Offline, the passenger shows "Sin unidades", which can mislead.
- L6 (2026-11-22, user): "si" (start part 2). Design: role 'admin' chosen on the home screen, email/password sign-in, `admins/<uid> === true` checked after sign-in and on hydrate; rules: only admins write `rutas`/`paradas` with field validation; `admins` read own entry only, write false (console only). Mock mode: demo admin account clearly labeled.
- L7 (2026-11-22): T2 implemented by Codex. Checks: vitest 104 passed, tsc passed, eslint 0 errors. Device (Motorola): "Soy administrador" opens the admin login; fake credentials are rejected ("No pudimos iniciar sesión…").
- L8 (2026-11-22, independent verifier): no blockers. S3 partial: client gating is correct, rules are correct by analysis only, with no emulator (firebase CLI and rules-unit-testing not installed). S2 did not regress. Notes for T3: write per id or with a multi-path update, never `set` on the whole `/rutas`; harden with `$other: .validate false`, numeric `polyline/$i`, non-empty `linea_id`; deleting a route orphans its stops, so deactivate instead; an offline admin hydrate may hang on `get()`; the demo admin strings ship in the bundle but grant nothing outside mock mode. Emulator probes 1–8 are listed in the verifier report and are pending until tooling is approved.
- L9 (2026-11-22): user created the admin user (email/password) and the `admins/<uid>` entry, and published the T2 rules. Device (Motorola, Firebase mode): admin sign-in lands on "Administración" with 3 lines and 6 directions; signing out to driver gives a shift with 4 pings and 0 failed, so the vehicle rules still work. T2 closed.
- L10 (2026-11-22, user): "si" (start part 3). Design: line-level CRUD (create line, edit its trace and stops, activate or deactivate the line; no hard delete). Editor: tap waypoints, snap with public OSRM (needs internet, falls back to straight segments with a notice), stops placed by tap and snapped onto the polyline, ordered by distance along it; on save the vuelta is generated reversed and everything is written in one multi-path update; optional `waypoints` stored on the ida route. Rules hardening from L8. User must republish rules after T3.
- L11 (2026-11-22): T3 implemented by Codex: admin list, line editor (OSRM snap with a straight-line fallback and 10 s timeout, stops snapped within 150 m and ordered along the line), automatic vuelta, one multi-path save, `setLineActive`, rules hardening (`$other` false, numeric polyline and waypoints points, no route deletes).
- L12 (2026-11-22, independent verifier): no blockers. S4 met by analysis and probes; S2 and S3 did not regress. A save nulls only this line's stops, with no `natura`/`natura-2` collision; the payload matches the rules; seed.json passes; OSRM receives only coordinates. Follow-ups applied: save is enabled only when the catalog source is 'remote' and the draft reloads from remote; the probes were added as tests/adminLineSafety.test.ts. Checks: vitest 126 passed, tsc passed, eslint 0 errors. Still open: device write test after the user republishes the rules; the emulator rules tests (from L8) need tooling.
