const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all main parts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM main_part_master ORDER BY main_part_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch main parts' });
  }
});

// GET single main part
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM main_part_master WHERE main_part_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Main part not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch main part' });
  }
});

// CREATE main part
router.post('/', async (req, res) => {
  const { part_code, part_name, description, revision } = req.body;
  if (!part_code || !part_name) {
    return res.status(400).json({ error: 'part_code and part_name are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO main_part_master (part_code, part_name, description, revision)
       VALUES ($1, $2, $3, COALESCE($4, 'A')) RETURNING *`,
      [part_code, part_name, description || null, revision]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'part_code already exists' });
    }
    res.status(500).json({ error: 'Failed to create main part' });
  }
});

// UPDATE main part
router.put('/:id', async (req, res) => {
  const { part_code, part_name, description, revision, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE main_part_master
       SET part_code = COALESCE($1, part_code),
           part_name = COALESCE($2, part_name),
           description = COALESCE($3, description),
           revision = COALESCE($4, revision),
           status = COALESCE($5, status)
       WHERE main_part_id = $6 RETURNING *`,
      [part_code, part_name, description, revision, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Main part not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'part_code already exists' });
    }
    res.status(500).json({ error: 'Failed to update main part' });
  }
});

// DELETE main part
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM main_part_master WHERE main_part_id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Main part not found' });
    }
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete — this main part has assembly rounds or scan logs linked to it.' });
    }
    res.status(500).json({ error: 'Failed to delete main part' });
  }
});

module.exports = router;
