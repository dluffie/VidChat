# Assets

Expo build assets referenced by [`app.json`](../app.json). Placeholder artwork is
committed here so `eas build` / `expo run:android` work out of the box; replace the
files in place (keeping the names and dimensions) with real artwork when available.

| File | Dimensions | Referenced by |
|---|---|---|
| `icon.png` | 1024×1024 | `expo.icon` — app icon |
| `adaptive-icon.png` | 1024×1024 | `expo.android.adaptiveIcon.foregroundImage` (on `#0A0F1D`) |
| `splash-icon.png` | 512×512 | `expo-splash-screen` plugin (`imageWidth: 200`, `contain`) |
| `favicon.png` | 64×64 | `expo.web.favicon` |

For local Expo Go development these are not strictly required, but they are needed
for EAS Build and for native `expo run:*` builds.

## Brand note

The app is named **Convey** (`expo.name` in [`app.json`](../app.json)). The artwork
here is still placeholder: the committed PNGs are flat-colour squares generated at
build time, not real icon designs. Replace `icon.png` and `adaptive-icon.png` with
real Convey artwork before any public release.

## Theming note

`app.json` sets `expo.userInterfaceStyle` to `"automatic"` so the **System** theme
option can follow the device's light/dark setting. The splash and adaptive-icon
backgrounds (`#0A0F1D`) match the Aurora Dark canvas; the in-app appearance picker
covers the other themes (Aurora Light, Claude Warm, Midnight).
