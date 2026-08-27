const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET full BOM for a given main part (joined with child part details)
router.get('/main-part/:mainPartId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.bom_id, b.main_part_id, b.child_part_id, b.qty_required, b.sequence_no,
              c.part_code, c.part_name, c.category
       FROM bom_link b
       JOIN child_part_master c ON c.child_part_id = b.child_part_id
       WHERE b.main_part_id = $1
       ORDER BY b.sequence_no NULLS LAST, b.bom_id`,
      [req.params.mainPartId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch BOM' });
  }
});

// ADD a child part to a main part's BOM
router.post('/', async (req, res) => {
  const { main_part_id, child_part_id, qty_required, sequence_no } = req.body;
  if (!main_part_id || !child_part_id) {
    return res.status(400).json({ error: 'main_part_id and child_part_id are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO bom_link (main_part_id, child_part_id, qty_required, sequence_no)
       VALUES ($1, $2, COALESCE($3, 1), $4) RETURNING *`,
      [main_part_id, child_part_id, qty_required, sequence_no || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This child part is already linked to this main part' });
    }
    res.status(500).json({ error: 'Failed to link child part' });
  }
});

// UPDATE a BOM line (change qty or sequence)
router.put('/:bomId', async (req, res) => {
  const { qty_required, sequence_no } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bom_link
       SET qty_required = COALESCE($1, qty_required),
           sequence_no = COALESCE($2, sequence_no)
       WHERE bom_id = $3 RETURNING *`,
      [qty_required, sequence_no, req.params.bomId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'BOM line not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update BOM line' });
  }
});

// REMOVE a child part from a main part's BOM
router.delete('/:bomId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM bom_link WHERE bom_id = $1 RETURNING *',
      [req.params.bomId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'BOM line not found' });
    }
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete BOM line' });
  }
});

module.exports = router;
