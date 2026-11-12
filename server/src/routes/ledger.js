const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /ledger
 * Returns all audit ledger transactions and summary stats.
 */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM ledger
      ORDER BY id DESC
    `).all();

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        SUM(CASE WHEN decision = 'BOUGHT' THEN line_total ELSE 0 END) as total_spent,
        SUM(CASE WHEN decision = 'BOUGHT' THEN qty ELSE 0 END) as items_bought,
        SUM(CASE WHEN decision = 'SUBSTITUTED' THEN 1 ELSE 0 END) as substitutions,
        SUM(CASE WHEN decision = 'BLOCKED' THEN 1 ELSE 0 END) as blocks
      FROM ledger
    `).get();

    res.json({
      summary: {
        total_entries: summary?.total_entries || 0,
        total_spent: +(summary?.total_spent || 0).toFixed(2),
        items_bought: summary?.items_bought || 0,
        substitutions: summary?.substitutions || 0,
        blocks: summary?.blocks || 0
      },
      rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
