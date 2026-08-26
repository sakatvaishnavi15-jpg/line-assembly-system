# Line Assembly Verification System

One folder containing both projects:
- `backend/` — Node.js + Express + PostgreSQL API
- `frontend/` — Electron + React desktop app (the operator UI)

## First-time setup

1. **Create the backend's `.env` file.**
   Go into `backend/`, create a new file named exactly `.env` (copy `.env.example` if present,
   or create it fresh), with:
   ```
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=line_assembly_db
   PGUSER=postgres
   PGPASSWORD=your_real_postgres_password
   PORT=4000
   ```

2. **Install everything** (run this from the ROOT folder, not inside backend/ or frontend/):
   ```
   npm install
   npm run install:all
   ```

3. **Make sure your PostgreSQL database `line_assembly_db` already has the 6 tables created**
   (main_part_master, child_part_master, bom_link, qr_code_master, assembly_round, scan_log).
   If not, run `backend/line_assembly_schema.sql` (if present) in pgAdmin's Query Tool first.

## Running everything

From the ROOT folder, one command starts both the backend server and the Electron app together:
```
npm run dev
```

You'll see both logs in the same terminal, color-coded:
- Green `[BACKEND]` — the Express server (should show "running on http://localhost:4000")
- Cyan `[FRONTEND]` — Vite + Electron (a desktop window should open automatically)

To stop both, press `Ctrl+C` once in that terminal.

## Running them separately (optional)

If you ever want to run just one:
```
npm run backend      # just the API
npm run frontend     # just the Electron app (needs backend already running)
```

## Project structure

```
line-assembly-system/
├── package.json          <- root: run both projects together
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── routes/       (main-parts, child-parts, bom-links, qr-codes, rounds)
│   │   └── utils/labelGenerator.js
│   ├── .env               <- YOU create this, with your real DB password
│   └── package.json
└── frontend/
    ├── electron/          (main.cjs, preload.cjs)
    ├── src/
    │   ├── pages/          (Assembly, MainParts, ChildParts, BomLinks, QrCodes)
    │   ├── api.js
    │   └── theme.css
    └── package.json
```
