const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../mandate.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS mandates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekly_budget REAL NOT NULL,
    per_item_cap REAL NOT NULL,
    allowed_categories TEXT NOT NULL,
    auto_approve_under REAL NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    mandate_id INTEGER,
    request_text TEXT,
    status TEXT NOT NULL,
    messages_json TEXT,
    cart_json TEXT,
    paypal_order_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(mandate_id) REFERENCES mandates(id)
  );

  CREATE TABLE IF NOT EXISTS run_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    step_no INTEGER NOT NULL,
    tool TEXT NOT NULL,
    input_json TEXT,
    output_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES runs(id)
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    product_id TEXT,
    name TEXT,
    qty INTEGER,
    unit_price REAL,
    line_total REAL,
    decision TEXT NOT NULL,
    reason TEXT,
    paypal_order_id TEXT,
    transaction_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES runs(id)
  );
`);

// Seed default mandate if none exists
const existingMandate = db.prepare('SELECT * FROM mandates ORDER BY id DESC LIMIT 1').get();
if (!existingMandate) {
  db.prepare(`
    INSERT INTO mandates (weekly_budget, per_item_cap, allowed_categories, auto_approve_under, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(20.00, 6.00, JSON.stringify(["groceries", "cleaning"]), 15.00, new Date().toISOString());
}

module.exports = db;
