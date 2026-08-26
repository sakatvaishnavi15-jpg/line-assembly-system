# Line Assembly Backend API

Node.js + Express + PostgreSQL backend for the QR-based line assembly verification system.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your PostgreSQL password:
   ```
   copy .env.example .env
   ```
   Edit `.env` and set `PGPASSWORD` to whatever you set in pgAdmin.

3. Start the server:
   ```
   npm start
   ```
   You should see: `Line Assembly backend running on http://localhost:4000`

4. Test it's alive by opening this in a browser: http://localhost:4000/api/health

## API Endpoints

### Main Parts
- `GET    /api/main-parts` — list all
- `GET    /api/main-parts/:id` — get one
- `POST   /api/main-parts` — create `{ part_code, part_name, description, revision }`
- `PUT    /api/main-parts/:id` — update
- `DELETE /api/main-parts/:id` — delete

### Child Parts
- `GET    /api/child-parts` — list all
- `POST   /api/child-parts` — create `{ part_code, part_name, uom, category }`
- `PUT    /api/child-parts/:id` — update
- `DELETE /api/child-parts/:id` — delete

### BOM Links (attach child parts to a main part)
- `GET    /api/bom-links/main-part/:mainPartId` — get full BOM for a main part
- `POST   /api/bom-links` — create `{ main_part_id, child_part_id, qty_required, sequence_no }`
- `PUT    /api/bom-links/:bomId` — update qty/sequence
- `DELETE /api/bom-links/:bomId` — remove from BOM

### QR Codes
- `GET    /api/qr-codes?child_part_id=1` — list QR codes (optionally filtered)
- `POST   /api/qr-codes/generate` — create one QR `{ child_part_id, batch_no }` → returns `qr_image` (base64 PNG)
- `POST   /api/qr-codes/generate-bulk` — create many `{ child_part_id, batch_no, count }`

### Assembly Rounds (the live scanning workflow)
- `POST   /api/rounds/start` — start a round `{ main_part_id, operator_name }` → returns round + checklist
- `GET    /api/rounds/:roundId` — get round status + checklist
- `POST   /api/rounds/:roundId/scan` — scan a QR `{ qr_code }`
  - Validates: QR exists, belongs to this main part's BOM, not a duplicate, quantity not exceeded
  - When the LAST required part is scanned, the response includes `finished_assembly_qr`
    containing the new `build_serial_no` and a `label_endpoint` URL to fetch the printable label.
- `GET    /api/rounds/:roundId/label` — returns a **PDF** build label (QR code + barcode + human-readable
  serial + full parts table with quantities) for a completed round. This is what you print/attach to the
  finished assembly. Open it directly in a browser, or fetch it and pipe straight to a printer.

## Typical flow from the frontend

1. Operator selects/scans main part → `POST /api/rounds/start`
2. App shows checklist from the response
3. Operator scans each child part → `POST /api/rounds/:roundId/scan` for each
4. When `round_complete: true` comes back, show `finished_assembly_qr.qr_image` on screen (and/or send to a label printer)
5. App resets and starts the next round automatically
