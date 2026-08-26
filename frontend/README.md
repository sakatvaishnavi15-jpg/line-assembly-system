# Line Assembly — Desktop App (Electron + React)

The scanning station and setup screens for the line assembly system. Talks to the
`line-assembly-backend` API at `http://localhost:4000`.

## Setup

1. Make sure the backend is running first (`npm start` in the backend folder,
   confirm `http://localhost:4000/api/health` responds).

2. Install dependencies here:
   ```
   npm install
   ```

3. Run in development mode (opens as a desktop window, hot-reloads on changes):
   ```
   npm run electron:dev
   ```

## What's included

- **Scan Station** (`/`) — the live operator screen. Select a main part, start a round,
  scan child part QR codes (works with a USB/Bluetooth handheld scanner acting as a
  keyboard, or manual typing). Shows a live checklist, pass/fail feedback per scan,
  and when the round completes, a button to open/print the finished build label PDF —
  then one click starts the next round immediately.
- **Main Parts** (`/main-parts`) — create/view/delete finished assemblies.
- **Child Parts** (`/child-parts`) — create/view/delete components.
- **Bill of Materials** (`/bom`) — link child parts to a main part with required quantities.
- **QR Codes** (`/qr-codes`) — generate one or many QR codes for a child part, with a
  Print button for label sheets.

## Building an installer (later)

Once you're happy with it, `npm run electron:build` will package a Windows `.exe`
installer using electron-builder. You may need to add a `"build"` config block to
`package.json` first (icon, app id, etc.) — ask me when you're ready for this step.

## Notes

- The scan input field auto-focuses whenever a round is active — this is what makes
  physical barcode/QR scanner guns work without any camera code. They just "type" the
  scanned value into whatever's focused and send Enter.
- If you rename ports or the backend URL, update `API_BASE` in `src/api.js`.
