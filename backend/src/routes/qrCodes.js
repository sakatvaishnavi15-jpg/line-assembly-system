const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../db');
const { generateQrLabelSheetPDF } = require('../utils/qrLabelSheet.js');

// GET all QR codes (optionally filter by child_part_id)
router.get('/', async (req, res) => {
  const { child_part_id } = req.query;
  try {
    let result;
    if (child_part_id) {
      result = await pool.query(
        'SELECT * FROM qr_code_master WHERE child_part_id = $1 ORDER BY qr_id DESC',
        [child_part_id]
      );
    } else {
      result = await pool.query('SELECT * FROM qr_code_master ORDER BY qr_id DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// GENERATE a new QR code for a child part (creates DB row + returns scannable image)
router.post('/generate', async (req, res) => {
  const { child_part_id, batch_no } = req.body;
  if (!child_part_id) {
    return res.status(400).json({ error: 'child_part_id is required' });
  }
  try {
    // Confirm child part exists and grab its part_code for a readable QR value
    const childResult = await pool.query(
      'SELECT part_code FROM child_part_master WHERE child_part_id = $1',
      [child_part_id]
    );
    if (childResult.rows.length === 0) {
      return res.status(404).json({ error: 'Child part not found' });
    }
    const partCode = childResult.rows[0].part_code;

    // Unique code: PARTCODE-BATCH-timestamp-random
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const qrCodeValue = `${partCode}-${batch_no || 'NA'}-${uniqueSuffix}`;

    const insertResult = await pool.query(
      `INSERT INTO qr_code_master (qr_code, child_part_id, batch_no)
       VALUES ($1, $2, $3) RETURNING *`,
      [qrCodeValue, child_part_id, batch_no || null]
    );

    const qrImageDataUrl = await QRCode.toDataURL(qrCodeValue);

    res.status(201).json({
      ...insertResult.rows[0],
      qr_image: qrImageDataUrl // base64 PNG, ready to display or print
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// GENERATE MULTIPLE QR codes at once for a child part (bulk batch printing)
router.post('/generate-bulk', async (req, res) => {
  const { child_part_id, batch_no, count } = req.body;
  if (!child_part_id || !count) {
    return res.status(400).json({ error: 'child_part_id and count are required' });
  }
  try {
    const childResult = await pool.query(
      'SELECT part_code FROM child_part_master WHERE child_part_id = $1',
      [child_part_id]
    );
    if (childResult.rows.length === 0) {
      return res.status(404).json({ error: 'Child part not found' });
    }
    const partCode = childResult.rows[0].part_code;
    const generated = [];

    for (let i = 0; i < count; i++) {
      const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
      const qrCodeValue = `${partCode}-${batch_no || 'NA'}-${uniqueSuffix}`;
      const insertResult = await pool.query(
        `INSERT INTO qr_code_master (qr_code, child_part_id, batch_no)
         VALUES ($1, $2, $3) RETURNING *`,
        [qrCodeValue, child_part_id, batch_no || null]
      );
      const qrImageDataUrl = await QRCode.toDataURL(qrCodeValue);
      generated.push({ ...insertResult.rows[0], qr_image: qrImageDataUrl });
    }

    res.status(201).json(generated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

// GENERATE a printable PDF label sheet — one small label per page,
// containing just the part code, QR image, and QR code text.
router.post('/label-sheet', async (req, res) => {
  const { items } = req.body; // [{ qr_code, part_code }, ...]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }
  try {
    const pdfBuffer = await generateQrLabelSheetPDF(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="qr-labels.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate QR label sheet' });
  }
});

module.exports = router;