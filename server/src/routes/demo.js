const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /demo/reset
 * Resets run history and ledger, reseeding the mandate to standard hackathon demo values.
 */
router.post('/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM ledger;
      DELETE FROM run_steps;
      DELETE FROM runs;
      DELETE FROM mandates;
    `);

    const defaultMandate = {
      weekly_budget: 20.00,
      per_item_cap: 6.00,
      allowed_categories: JSON.stringify(['groceries', 'cleaning']),
      auto_approve_under: 15.00,
      created_at: new Date().toISOString()
    };

    db.prepare(`
      INSERT INTO mandates (weekly_budget, per_item_cap, allowed_categories, auto_approve_under, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      defaultMandate.weekly_budget,
      defaultMandate.per_item_cap,
      defaultMandate.allowed_categories,
      defaultMandate.auto_approve_under,
      defaultMandate.created_at
    );

    const seededMandate = db.prepare('SELECT * FROM mandates ORDER BY id DESC LIMIT 1').get();

    res.json({
      success: true,
      message: 'Demo state reset successfully.',
      mandate: {
        ...seededMandate,
        allowed_categories: JSON.parse(seededMandate.allowed_categories)
      },
      sample_prompt: 'I need 2L milk, 2kg rice, dish soap, an HDMI cable, and India Gate classic basmati'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
