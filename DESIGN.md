# Design

Visual world: **rótulo pintado** — Cúcuta's hand-painted shop and route signs. Flat enamel colour fields and heavy condensed painted lettering on the data; quiet ink-on-paper chrome everywhere else. Light theme only (outdoor use in strong sun); dark theme is deferred.

Tokens live in `src/constants/theme.ts`. Use the tokens, never raw hex in screens.

## Colour

| Role | Value | Use |
| --- | --- | --- |
| ground | `#F1F0E9` | Screen background |
| surface | `#FFFFFF` | Quiet sections (separated from ground by tone, no shadow) |
| ink | `#141414` | Text, outlines, primary button fill |
| inkMuted | `#4A4A45` | Secondary text (≥4.5:1 on ground) |
| signYellow / onYellow | `#FFC72C` / ink | Next stop placard, vehicle markers, product mark |
| signGreen / onGreen | `#00753A` / white | In service |
| signRed / onRed | `#C8102E` / white | Stale data, end shift, destructive actions |
| signBlue / onBlue | `#0050A0` / white | Route line on the map |
| passedGround / passedInk | `#ECECE6` / `#5C5C56` | Passed stops, out of service |

Colour goes on data (stops, ETA, states), not on chrome. No gradients, no resting shadows, no blur, no violet.

## Type

- Display: Anton (`@expo-google-fonts/anton`) for screen titles, stop names (uppercase transform) and figures.
- Body: platform Roboto. Sizes: label 13, body 16, title 20, headline 28, display 40, eta 64. Body never below 14.

## Shape and components

- Radius 4 for signs and controls; pill only for small status chips.
- `Placard`: flat fill, 2 dp ink outline (4 dp when selected); tones yellow, green, red, blue, passed, plain.
- `EtaCard`: next stop = yellow placard with 64 sp ETA; other approaching = plain placard, 40 sp; stale = red + signal-off icon; passed = grey + check. Every state is colour + icon + word.
- `Button`: primary (ink fill), secondary (ink outline), danger (red fill), dangerOutline (red outline). Height ≥ 52 dp.
- Touch targets ≥ 48 dp. The driver's primary shift action is pinned in a footer, always visible.
- Icons: MaterialCommunityIcons through `src/components/Icon.tsx`. No emoji or unicode glyphs.

## Never

Eyebrow labels, 01/02 numbering, gradients, resting shadows, glass, emoji, monospace outside code, tiny uppercase letter-spaced labels.
