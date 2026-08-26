-- =====================================================
-- LINE ASSEMBLY VERIFICATION SYSTEM — DATABASE SCHEMA
-- =====================================================

-- 1. MAIN PART MASTER
-- The finished assembly / product being built
CREATE TABLE main_part_master (
    main_part_id    SERIAL PRIMARY KEY,
    part_code       VARCHAR(50) UNIQUE NOT NULL,
    part_name       VARCHAR(150) NOT NULL,
    description     TEXT,
    revision        VARCHAR(20) DEFAULT 'A',
    status          VARCHAR(20) DEFAULT 'Active', -- Active / Inactive
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 2. CHILD PART MASTER
-- Every component that can go into any assembly
CREATE TABLE child_part_master (
    child_part_id   SERIAL PRIMARY KEY,
    part_code       VARCHAR(50) UNIQUE NOT NULL,
    part_name       VARCHAR(150) NOT NULL,
    category        VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 3. BOM LINK
-- Links child parts to a main part (the Bill of Materials)
CREATE TABLE bom_link (
    bom_id          SERIAL PRIMARY KEY,
    main_part_id    INT NOT NULL REFERENCES main_part_master(main_part_id) ON DELETE CASCADE,
    child_part_id   INT NOT NULL REFERENCES child_part_master(child_part_id) ON DELETE RESTRICT,
    qty_required    INT NOT NULL DEFAULT 1,
    sequence_no     INT, -- optional station/scan order
    UNIQUE (main_part_id, child_part_id)
);

-- 4. QR CODE MASTER
-- Each physical unit/batch of a child part gets a unique QR code
CREATE TABLE qr_code_master (
    qr_id           SERIAL PRIMARY KEY,
    qr_code         VARCHAR(100) UNIQUE NOT NULL, -- the actual encoded string
    child_part_id   INT NOT NULL REFERENCES child_part_master(child_part_id) ON DELETE RESTRICT,
    batch_no        VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'Active', -- Active / Used / Blocked
    generated_at    TIMESTAMP DEFAULT NOW()
);

-- 5. ASSEMBLY ROUND
-- One "round" = one build cycle of a main part on the line
CREATE TABLE assembly_round (
    round_id        SERIAL PRIMARY KEY,
    main_part_id    INT NOT NULL REFERENCES main_part_master(main_part_id),
    build_serial_no VARCHAR(100) UNIQUE, -- generated when round completes
    operator_name   VARCHAR(100),
    start_time      TIMESTAMP DEFAULT NOW(),
    end_time        TIMESTAMP,
    status          VARCHAR(20) DEFAULT 'InProgress' -- InProgress / Completed / Aborted
);

-- 6. SCAN LOG
-- Every individual QR scan during a round
CREATE TABLE scan_log (
    scan_id         SERIAL PRIMARY KEY,
    round_id        INT NOT NULL REFERENCES assembly_round(round_id) ON DELETE CASCADE,
    child_part_id   INT NOT NULL REFERENCES child_part_master(child_part_id),
    qr_id           INT REFERENCES qr_code_master(qr_id),
    scan_time       TIMESTAMP DEFAULT NOW(),
    result          VARCHAR(20) NOT NULL, -- Pass / Fail-WrongPart / Fail-Duplicate / Fail-NotInBOM
    remarks         TEXT
);

-- =====================================================
-- INDEXES (speed up lookups during live scanning)
-- =====================================================
CREATE INDEX idx_bom_main_part ON bom_link(main_part_id);
CREATE INDEX idx_qr_code ON qr_code_master(qr_code);
CREATE INDEX idx_scan_round ON scan_log(round_id);
CREATE INDEX idx_round_main_part ON assembly_round(main_part_id);
