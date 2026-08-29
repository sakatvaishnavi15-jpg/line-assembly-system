const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../db');
const { generateBuildLabelPDF } = require('../utils/labelGenerator');

// -------------------------------------------------------
// START A NEW ROUND
// -------------------------------------------------------
router.post('/start', async (req, res) => {
  const { main_part_id, operator_name } = req.body;
  if (!main_part_id) {
    return res.status(400).json({ error: 'main_part_id is required' });
  }
  try {
    // Make sure this main part actually has a BOM defined
    const bomCheck = await pool.query(
      'SELECT COUNT(*) FROM bom_link WHERE main_part_id = $1',
      [main_part_id]
    );
    if (parseInt(bomCheck.rows[0].count, 10) === 0) {
      return res.status(400).json({ error: 'This main part has no BOM (child parts) linked yet' });
    }

    const roundResult = await pool.query(
      `INSERT INTO assembly_round (main_part_id, operator_name)
       VALUES ($1, $2) RETURNING *`,
      [main_part_id, operator_name || null]
    );
    const round = roundResult.rows[0];
    const checklist = await getChecklist(round.round_id, main_part_id);

    res.status(201).json({ round, checklist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start round' });
  }
});

// -------------------------------------------------------
// GET ROUND STATUS / CHECKLIST
// -------------------------------------------------------
router.get('/:roundId', async (req, res) => {
  try {
    const roundResult = await pool.query(
      'SELECT * FROM assembly_round WHERE round_id = $1',
      [req.params.roundId]
    );
    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    const round = roundResult.rows[0];
    const checklist = await getChecklist(round.round_id, round.main_part_id);
    res.json({ round, checklist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
});

// -------------------------------------------------------
// SCAN A QR CODE INTO THIS ROUND  (the core operation)
// -------------------------------------------------------
router.post('/:roundId/scan', async (req, res) => {
  const { roundId } = req.params;
  const { qr_code, round_number } = req.body;

  if (!qr_code) {
    return res.status(400).json({ error: 'qr_code is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Load the round
    const roundResult = await client.query(
      'SELECT * FROM assembly_round WHERE round_id = $1 FOR UPDATE',
      [roundId]
    );
    if (roundResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Round not found' });
    }
    const round = roundResult.rows[0];

    if (round.status === 'Completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This round is already completed' });
    }

    // 2. Look up the QR code; allow a raw child part code such as USRMAN to be scanned directly.
    const qrResult = await client.query(
      'SELECT * FROM qr_code_master WHERE qr_code = $1',
      [qr_code]
    );

    let qrRow = qrResult.rows[0];
    let childPartId = qrRow?.child_part_id;

    if (!qrRow) {
      const partCodeMatch = await client.query(
        `SELECT child_part_id, part_code
         FROM child_part_master
         WHERE part_code = $1 OR part_code = split_part($1, '-', 1)`,
        [qr_code]
      );

      if (partCodeMatch.rows.length === 0) {
        await logScan(client, roundId, null, null, 'Fail-UnknownQR', 'QR code not found in system');
        await client.query('COMMIT');
        return res.status(400).json({ result: 'Fail-UnknownQR', message: 'This QR code is not recognized' });
      }

      childPartId = partCodeMatch.rows[0].child_part_id;
      qrRow = { qr_id: null, child_part_id: childPartId, qr_code: qr_code };
    }

    // 3. Confirm this child part belongs to this main part's BOM
    const bomResult = await client.query(
      'SELECT * FROM bom_link WHERE main_part_id = $1 AND child_part_id = $2',
      [round.main_part_id, childPartId]
    );
    if (bomResult.rows.length === 0) {
      await logScan(client, roundId, childPartId, qrRow.qr_id, 'Fail-NotInBOM', 'Part not required for this assembly');
      await client.query('COMMIT');
      return res.status(400).json({ result: 'Fail-NotInBOM', message: 'This part is not part of this assembly\'s BOM' });
    }
    const bomLine = bomResult.rows[0];

    // 4. Check this exact QR hasn't already been scanned successfully in this round
    const dupCheck = await client.query(
      `SELECT * FROM scan_log WHERE round_id = $1 AND qr_id = $2 AND result = 'Pass'`,
      [roundId, qrRow.qr_id]
    );
    if (dupCheck.rows.length > 0) {
      await logScan(client, roundId, childPartId, qrRow.qr_id, 'Fail-Duplicate', 'This exact QR was already scanned in this round');
      await client.query('COMMIT');
      return res.status(400).json({ result: 'Fail-Duplicate', message: 'This part was already scanned in this round' });
    }

    // 5. Check quantity not already fulfilled for this child part
    const countResult = await client.query(
      `SELECT COUNT(*) FROM scan_log WHERE round_id = $1 AND child_part_id = $2 AND result = 'Pass'`,
      [roundId, childPartId]
    );
    const alreadyScanned = parseInt(countResult.rows[0].count, 10);
    if (alreadyScanned >= bomLine.qty_required) {
      await logScan(client, roundId, childPartId, qrRow.qr_id, 'Fail-QuantityExceeded', 'Required quantity for this part already met');
      await client.query('COMMIT');
      return res.status(400).json({ result: 'Fail-QuantityExceeded', message: 'Required quantity for this part is already met' });
    }

    // 6. All good — log a Pass
    await logScan(client, roundId, childPartId, qrRow.qr_id, 'Pass', null);

    // Optionally mark this QR as used up so it can never be reused anywhere
    await client.query(
      `UPDATE qr_code_master SET status = 'Used' WHERE qr_id = $1`,
      [qrRow.qr_id]
    );

    // 7. Check whether the whole round is now complete
    const checklist = await getChecklistWithClient(client, roundId, round.main_part_id);
    const isComplete = checklist.every((item) => item.scanned_qty >= item.qty_required);

    let updatedRound = round;
    let finishedQr = null;

    if (isComplete) {
      // Generate the finished-assembly build serial number + QR code.
      // Format must be: MAINPARTNOYYYYMMDDUNQ0001
      // The final 0001 segment is the sequence number for that main part, not the DB round id.
      const mainPartResult = await client.query(
        'SELECT part_code, part_name FROM main_part_master WHERE main_part_id = $1',
        [round.main_part_id]
      );
      const mainPartCode = mainPartResult.rows[0].part_code;
      const now = new Date();
      const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

      // Reset the serial sequence every day for each main part. The client-sent
      // round number is not authoritative for build serial generation because it
      // may be stale from a prior day or another run.
      const todayDate = new Date();
      const todayDateString = todayDate.toISOString().slice(0, 10);

      const serialSeqResult = await client.query(
        `SELECT build_serial_no
         FROM assembly_round
         WHERE main_part_id = $1
           AND status = 'Completed'
           AND build_serial_no IS NOT NULL
           AND start_time::date = $2
         ORDER BY build_serial_no ASC`,
        [round.main_part_id, todayDateString]
      );

      let maxSerialSuffix = 0;
      for (const row of serialSeqResult.rows) {
        const match = String(row.build_serial_no).match(new RegExp(`^${mainPartCode}${dateStamp}UNQ(\\d{4})$`));
        if (match) {
          const suffix = parseInt(match[1], 10);
          if (suffix > maxSerialSuffix) {
            maxSerialSuffix = suffix;
          }
        }
      }

      let serialRoundNumber = maxSerialSuffix + 1;
      let buildSerialNo = null;
      let candidateRoundNumber = serialRoundNumber;

      while (!buildSerialNo) {
        const roundNumber = String(candidateRoundNumber).padStart(4, '0');
        const candidateSerial = `${mainPartCode}${dateStamp}UNQ${roundNumber}`;

        const serialExists = await client.query(
          'SELECT 1 FROM assembly_round WHERE build_serial_no = $1',
          [candidateSerial]
        );

        if (serialExists.rows.length === 0) {
          buildSerialNo = candidateSerial;
          serialRoundNumber = candidateRoundNumber;
        } else {
          candidateRoundNumber += 1;
        }
      }

      const completeResult = await client.query(
        `UPDATE assembly_round
         SET status = 'Completed', end_time = NOW(), build_serial_no = $1
         WHERE round_id = $2 RETURNING *`,
        [buildSerialNo, roundId]
      );
      updatedRound = completeResult.rows[0];

      // Note: the full printable label (QR + barcode + parts table) is generated
      // on demand via GET /api/rounds/:roundId/label — we just flag it's ready here.
      finishedQr = {
        build_serial_no: buildSerialNo,
        label_endpoint: `/rounds/${roundId}/label?t=${Date.now()}`
      };
    }

    await client.query('COMMIT');

    res.json({
      result: 'Pass',
      message: 'Part scanned successfully',
      checklist,
      round: updatedRound,
      round_complete: isComplete,
      finished_assembly_qr: finishedQr // populated only when this scan completed the round
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process scan' });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------
// RE-FETCH the finished assembly QR for an already-completed round
// -------------------------------------------------------
router.get('/:roundId/finished-qr', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT build_serial_no, status FROM assembly_round WHERE round_id = $1',
      [req.params.roundId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    const round = result.rows[0];
    if (round.status !== 'Completed' || !round.build_serial_no) {
      return res.status(400).json({ error: 'Round is not completed yet' });
    }
    const qrImageDataUrl = await QRCode.toDataURL(round.build_serial_no);
    res.json({ build_serial_no: round.build_serial_no, qr_image: qrImageDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate finished QR' });
  }
});

// -------------------------------------------------------
// GET the printable BUILD LABEL (PDF) for a completed round
// Contains: title, QR code, barcode, human-readable serial, and full parts table
// -------------------------------------------------------
router.get('/:roundId/label', async (req, res) => {
  const { roundId } = req.params;
  try {
    const roundResult = await pool.query(
      'SELECT * FROM assembly_round WHERE round_id = $1',
      [roundId]
    );
    if (roundResult.rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }
    const round = roundResult.rows[0];
    if (round.status !== 'Completed' || !round.build_serial_no) {
      return res.status(400).json({ error: 'Round is not completed yet — label not available' });
    }

    const mainPartResult = await pool.query(
      'SELECT part_name FROM main_part_master WHERE main_part_id = $1',
      [round.main_part_id]
    );
    const mainPartName = mainPartResult.rows[0].part_name;

    let mainPartBrand = 'IFB';
    try {
      const brandResult = await pool.query(
        'SELECT brand FROM main_part_master WHERE main_part_id = $1',
        [round.main_part_id]
      );
      mainPartBrand = brandResult.rows[0]?.brand || 'IFB';
    } catch (err) {
      if (err.code !== '42703') {
        throw err;
      }
    }

    // qty_required here doubles as the "parts used" list for the label table
    const checklist = await getChecklist(roundId, round.main_part_id);

    const partCode = await pool.query(
      'SELECT part_code FROM main_part_master WHERE main_part_id = $1',
      [round.main_part_id]
    );
    const totalQty = checklist.reduce((sum, item) => sum + Number(item.qty_required || 0), 0);
    // The build serial itself is the exact label code. Keep the last 4 digits as the round suffix.
    const displayCode = round.build_serial_no;

    const pdfBuffer = await generateBuildLabelPDF({
      mainPartName,
      mainPartBrand,
      partCode: partCode.rows[0].part_code,
      buildSerialNo: round.build_serial_no,
      displayCode,
      checklist
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${round.build_serial_no}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate build label' });
  }
});

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
async function logScan(client, roundId, childPartId, qrId, result, remarks) {
  await client.query(
    `INSERT INTO scan_log (round_id, child_part_id, qr_id, result, remarks)
     VALUES ($1, $2, $3, $4, $5)`,
    [roundId, childPartId, qrId, result, remarks]
  );
}

async function getChecklist(roundId, mainPartId) {
  return getChecklistWithClient(pool, roundId, mainPartId);
}

async function getChecklistWithClient(client, roundId, mainPartId) {
  const result = await client.query(
    `SELECT b.child_part_id, c.part_code, c.part_name, b.qty_required,
            COALESCE(sl.scanned_qty, 0) AS scanned_qty
     FROM bom_link b
     JOIN child_part_master c ON c.child_part_id = b.child_part_id
     LEFT JOIN (
       SELECT child_part_id, COUNT(*) AS scanned_qty
       FROM scan_log
       WHERE round_id = $1 AND result = 'Pass'
       GROUP BY child_part_id
     ) sl ON sl.child_part_id = b.child_part_id
     WHERE b.main_part_id = $2
     ORDER BY b.sequence_no NULLS LAST, b.bom_id`,
    [roundId, mainPartId]
  );
  return result.rows;
}

module.exports = router;