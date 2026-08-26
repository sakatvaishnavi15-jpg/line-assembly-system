const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all child parts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM child_part_master ORDER BY child_part_id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch child parts' });
  }
});

// CREATE child part
router.post('/', async (req, res) => {
  const { part_code, part_name, category } = req.body;
  if (!part_code || !part_name) {
    return res.status(400).json({ error: 'part_code and part_name are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO child_part_master (part_code, part_name, category)
       VALUES ($1, $2, $3) RETURNING *`,
      [part_code, part_name, category || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'part_code already exists' });
    }
    res.status(500).json({ error: 'Failed to create child part' });
  }
});

// UPDATE child part
router.put('/:id', async (req, res) => {
  const { part_code, part_name, category } = req.body;
  try {
    const result = await pool.query(
      `UPDATE child_part_master
       SET part_code = COALESCE($1, part_code),
           part_name = COALESCE($2, part_name),
           category = COALESCE($3, category)
       WHERE child_part_id = $4 RETURNING *`,
      [part_code, part_name, category, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child part not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'part_code already exists' });
    }
    res.status(500).json({ error: 'Failed to update child part' });
  }
});

// DELETE child part
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM child_part_master WHERE child_part_id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child part not found' });
    }
    res.json({ message: 'Deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete child part' });
  }
});

module.exports = router;
