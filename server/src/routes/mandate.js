const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /mandate
 * Retrieve the current active spending mandate.
 */
router.get('/', (req, res) => {
  try {
    const mandate = db.prepare('SELECT * FROM mandates ORDER BY id DESC LIMIT 1').get();
    if (!mandate) {
      return res.status(404).json({ error: 'No mandate found.' });
    }

    let allowedCategories = mandate.allowed_categories;
    try {
      allowedCategories = JSON.parse(allowedCategories);
    } catch {
      allowedCategories = allowedCategories.split(',').map(s => s.trim());
    }

    res.json({
      ...mandate,
      allowed_categories: allowedCategories
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /mandate
 * Save or update the active spending mandate.
 */
router.post('/', (req, res) => {
  try {
    const { weekly_budget, per_item_cap, allowed_categories, auto_approve_under } = req.body;

    if (weekly_budget === undefined || per_item_cap === undefined || auto_approve_under === undefined) {
      return res.status(400).json({ error: 'Missing required mandate fields.' });
    }

    const categoriesArray = Array.isArray(allowed_categories)
      ? allowed_categories
      : (allowed_categories || '').split(',').map(s => s.trim()).filter(Boolean);

    const categoriesJson = JSON.stringify(categoriesArray.length ? categoriesArray : ['groceries', 'cleaning']);

    const stmt = db.prepare(`
      INSERT INTO mandates (weekly_budget, per_item_cap, allowed_categories, auto_approve_under, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      parseFloat(weekly_budget),
      parseFloat(per_item_cap),
      categoriesJson,
      parseFloat(auto_approve_under),
      new Date().toISOString()
    );

    const updated = db.prepare('SELECT * FROM mandates ORDER BY id DESC LIMIT 1').get();
    res.json({
      ...updated,
      allowed_categories: JSON.parse(updated.allowed_categories)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
