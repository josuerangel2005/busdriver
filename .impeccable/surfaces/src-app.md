---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface brief: app screens (Android)

Scope: all app screens (home role select, passenger map + stops, ETA detail, consent, driver panel). Mode: operate.
Audience and job: passengers at a stop under strong sun, one hand, need "when does it arrive"; drivers glance for shift state.
Constraints: Material 3 structure and Android Back; 48 dp targets; WCAG AA; states never by color alone; Spanish copy kept as is; no business logic changes.

## Direction contract

THESIS: Cúcuta's hand-painted shop signs (rótulos) become the ETA board: each stop reads like a painted placard with one huge figure. Refuses the category default of grey Material cards with a small blue number.
OWN-WORLD: flat enamel fields, no gradients or resting shadows. Sign yellow #FFC72C, ink #141414, ground #FAFAF5, red #C8102E, green #00753A, blue #0050A0. Anton for display and figures, Roboto for body. Square sign corners (4 dp), thick 2 dp ink outlines only on painted placards.
STORY: the passenger sees the nearest painted ETA first, reads stop state by field color plus a word and icon, and trusts that stale data says so.
FIRST VIEWPORT: map top half; below it the next stop as a full-width yellow placard with the ETA in Anton at 64 sp; remaining stops as smaller placards.
FORM: rótulo pintado, candidate 7 of 7. seed:f7d4618cbac3146e
SIGNATURE: the ETA figure set like painted lettering, the one thing larger than everything else on screen.

Unresolved: dark theme deferred (outdoor sun use); real route pending.
