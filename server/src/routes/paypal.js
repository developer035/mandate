const express = require('express');
const router = express.Router();
const db = require('../db');
const { captureOrder } = require('../paypal');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * GET /paypal/return
 * Target of PayPal redirect after buyer approval.
 */
router.get('/return', async (req, res) => {
  try {
    const orderId = req.query.token;
    if (!orderId) {
      return res.status(400).send('Missing PayPal order token.');
    }

    // Locate the matching run
    const run = db.prepare('SELECT * FROM runs WHERE paypal_order_id = ?').get(orderId);
    if (!run) {
      return res.status(404).send(`No run found associated with PayPal order ID: ${orderId}`);
    }

    // Idempotency: Prevent duplicate capture if already completed
    if (run.status === 'COMPLETED') {
      return res.redirect(`${CLIENT_URL}/#/run?id=${run.id}&status=already_completed`);
    }

    // Capture payment in PayPal Sandbox
    const captureResult = await captureOrder(orderId);
    const transactionId = captureResult.transaction_id;

    // Retrieve the purchased items from the create_paypal_order step
    const orderStep = db.prepare(`
      SELECT output_json FROM run_steps
      WHERE run_id = ? AND tool = 'create_paypal_order'
      ORDER BY id DESC LIMIT 1
    `).get(run.id);

    if (orderStep && orderStep.output_json) {
      const output = JSON.parse(orderStep.output_json);
      const items = output.items || [];

      for (const item of items) {
        db.prepare(`
          INSERT INTO ledger (run_id, product_id, name, qty, unit_price, line_total, decision, reason, paypal_order_id, transaction_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'BOUGHT', 'Purchased via PayPal Sandbox', ?, ?, ?)
        `).run(
          run.id,
          item.product_id,
          item.name,
          item.qty,
          item.unit_price,
          item.line_total,
          orderId,
          transactionId,
          new Date().toISOString()
        );
      }
    }

    // Mark run as COMPLETED
    db.prepare("UPDATE runs SET status = 'COMPLETED' WHERE id = ?").run(run.id);

    // Redirect user back to the application UI
    res.redirect(`${CLIENT_URL}/#/run?id=${run.id}&status=captured&tx=${transactionId}`);
  } catch (err) {
    console.error('Error in PayPal return handler:', err);
    res.status(500).send(`Payment capture failed: ${err.message}`);
  }
});

/**
 * GET /paypal/cancel
 * Target of PayPal redirect when buyer cancels.
 */
router.get('/cancel', (req, res) => {
  try {
    const orderId = req.query.token;
    if (orderId) {
      db.prepare("UPDATE runs SET status = 'DENIED' WHERE paypal_order_id = ?").run(orderId);
    }
    res.redirect(`${CLIENT_URL}/#/run?status=cancelled`);
  } catch (err) {
    res.status(500).send(`Cancel handler error: ${err.message}`);
  }
});

/**
 * GET /paypal/simulate
 * Interactive sandbox simulator if real credentials are not yet entered.
 */
router.get('/simulate', (req, res) => {
  const token = req.query.token || 'SANDBOX_ORDER_DEMO';
  const total = req.query.total || '0.00';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PayPal Sandbox Checkout Simulator</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1120; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; max-width: 440px; width: 100%; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
        .logo { font-size: 24px; font-weight: 800; color: #38bdf8; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .logo span { color: #0284c7; }
        .badge { display: inline-block; background: #0284c720; color: #38bdf8; border: 1px solid #0284c740; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; text-transform: uppercase; }
        .amount { font-size: 36px; font-weight: 800; margin: 16px 0; color: #ffffff; }
        .info { background: #0f172a; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; text-align: left; color: #94a3b8; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-val { font-weight: 600; color: #f1f5f9; font-family: monospace; }
        .btn-pay { display: block; width: 100%; background: #ffc439; color: #111827; font-weight: 800; font-size: 15px; padding: 14px; border-radius: 12px; text-decoration: none; margin-top: 20px; box-sizing: border-box; transition: background 0.2s; }
        .btn-pay:hover { background: #fdb813; }
        .btn-cancel { display: block; width: 100%; color: #94a3b8; font-size: 13px; font-weight: 600; padding: 12px; text-decoration: none; margin-top: 8px; }
        .btn-cancel:hover { color: #f8fafc; }
        .note { font-size: 11px; color: #64748b; margin-top: 20px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Pay<span>Pal</span> <span style="font-size:12px; color:#94a3b8; font-weight:500;">Sandbox</span></div>
        <div class="badge">Agent Checkout Flow</div>
        <div style="font-size: 14px; color: #94a3b8;">Mandate Household Restock</div>
        <div class="amount">$${total}</div>
        
        <div class="info">
          <div class="info-row"><span>Order Reference:</span><span class="info-val">${token.substring(0, 22)}...</span></div>
          <div class="info-row"><span>Merchant:</span><span class="info-val">Mandate Storefront (Sandbox)</span></div>
          <div class="info-row"><span>Payment Intent:</span><span class="info-val">CAPTURE</span></div>
        </div>

        <a class="btn-pay" href="/paypal/return?token=${token}">Authorize & Capture Payment</a>
        <a class="btn-cancel" href="/paypal/cancel?token=${token}">Cancel Checkout</a>

        <div class="note">
          💡 This simulator confirms order creation and captures the mock transaction. To connect your live PayPal Sandbox business account, configure <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_SECRET</code> in your <code>.env</code> file.
        </div>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;
