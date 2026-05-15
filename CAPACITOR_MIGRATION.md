# Capacitor Migration

This project now has a Capacitor configuration and generated native platform projects for the patient app at `https://verihealthapp.fulscann.com`.

## What changed

- Added `capacitor.config.ts`
- Added Capacitor package entries in `package.json`
- Added helper scripts:
  - `npm run cap:copy`
  - `npm run cap:sync`
  - `npm run cap:open:android`
  - `npm run cap:open:ios`
- Generated real Capacitor `android/` and `ios/` projects
- Preserved the earlier placeholder folders as:
  - `android-legacy-placeholder/`
  - `ios-legacy-placeholder/`

## Runtime model

The Capacitor shell is configured to load the hosted patient app:

- default remote URL: `https://verihealthapp.fulscann.com`
- override variable: `CAPACITOR_SERVER_URL`

This keeps the native shell aligned with the patient domain, so the app stays in patient-only mode.

## Install and sync

1. Install dependencies:

```bash
npm install
```

2. Build the web app:

```bash
npm run build
```

3. Sync Capacitor assets and config:

```bash
npm run cap:sync
```

4. Open the platform project:

```bash
npm run cap:open:android
npm run cap:open:ios
```

## Deployment notes

- `VITE_PATIENT_APP_URL` should point to `https://verihealthapp.fulscann.com`
- `VITE_DASHBOARD_URL` should point to the clinician dashboard host
- `VITE_ALLOWED_HOSTS` should include both public hosts when needed
- Patient password-reset links and patient invite links now target the patient app host
- On macOS, install CocoaPods before building the iOS app locally
