# Assets

Expo build assets referenced by [`app.json`](../app.json).

| File | Dimensions | Referenced by |
|---|---|---|
| `icon.png` | 1024×1024 | `expo.icon` — full-bleed app icon (iOS masks it; Android falls back to it below API 26) |
| `adaptive-icon.png` | 1024×1024 | `expo.android.adaptiveIcon.foregroundImage` — mark only, transparent, over `#0A0F1D` |
| `monochrome-icon.png` | 1024×1024 | `expo.android.adaptiveIcon.monochromeImage` — Android 13+ themed icons |
| `splash-icon.png` | 1024×1024 | `expo-splash-screen` plugin (`imageWidth: 200`, `contain`) — mark only, transparent |
| `favicon.png` | 64×64 | `expo.web.favicon` |
| `generate-icons.py` | — | Regenerates every file above |

For local Expo Go development these are not strictly required, but they are needed
for EAS Build and for native `expo run:*` builds.

## The mark

A **gradient play triangle with two motion beams trailing behind it**. The triangle
says "video"; the beams say "in motion, being sent" — which is the whole point of
the app. It stays legible down to 24 px, where a more literal two-device glyph
would turn to mush.

It is drawn in the **Aurora Dark** palette so the launcher icon matches the app's
default theme:

| Role | Colour |
|---|---|
| Canvas | `#05060B` → `#121A38` vertical wash, with a soft violet bloom |
| Gradient | `#7C6BFF` (violet) → `#3FD0E0` (cyan) |
| Adaptive background | `#0A0F1D` |

## Regenerating

The artwork is generated, not hand-drawn, so it can be tweaked without a vector
editor. From this directory:

```bash
py generate-icons.py
```

This needs Pillow (`py -m pip install pillow`). The script writes all five PNGs.

Two constraints are encoded in it and worth keeping if you edit the geometry:

- **Adaptive safe zone.** Android guarantees only a 66 dp circle on the 108 dp
  canvas. The mark's furthest point sits 0.319 of the canvas from centre, so it is
  emitted at `ADAPTIVE_SCALE = 0.86` to stay inside the 0.3055 safe radius — it
  survives a circular mask, a squircle mask and the tight safe zone without
  clipping.
- **Corner rounding.** `rounded_poly()` places each corner arc *tangent to both
  adjoining edges* rather than centred on the vertex. Centring on the vertex — the
  obvious approach — makes the corners bulge into visible balls.

## Splash

The splash is the mark alone on the `#0A0F1D` canvas at 200 dp, with no wordmark:
it draws in a single frame and matches the app's own background, so there is no
flash between the splash and the first screen. Set `expo.userInterfaceStyle` to
`"automatic"` (already done) so the System theme can follow the device.

The adaptive-icon and splash backgrounds match the Aurora Dark canvas; the in-app
appearance picker covers the other themes (Aurora Light, Claude Warm, Midnight).
The launcher icon itself is intentionally a single fixed design.
