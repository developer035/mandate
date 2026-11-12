require('dotenv').config();
const { runAgentLoop } = require('../server/src/agent');
const { captureOrder } = require('../server/src/paypal');
const db = require('../server/src/db');

async function testFullFlow() {
  console.log('--- Step 1: Starting agent run with Groq model (openai/gpt-oss-120b) ---');
  const runId = 'test_e2e_' + Date.now();
  
  const runResult = await runAgentLoop({
    runId,
    userText: 'Buy 1 Amul toned milk and 1 Vim dish gel',
    dryRun: false
  });

  console.log('Agent loop outcome:', runResult);

  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
  console.log('Run recorded in DB:', { id: run.id, status: run.status, paypal_order_id: run.paypal_order_id });

  if (run.paypal_order_id) {
    console.log('\n--- Step 2: Testing capture flow for order:', run.paypal_order_id, '---');
    const capture = await captureOrder(run.paypal_order_id);
    console.log('Capture result:', capture);

    // Retrieve order items
    const orderStep = db.prepare("SELECT output_json FROM run_steps WHERE run_id = ? AND tool = 'create_paypal_order'").get(runId);
    const items = orderStep ? JSON.parse(orderStep.output_json).items || [] : [];

    for (const item of items) {
      db.prepare(`
        INSERT INTO ledger (run_id, product_id, name, qty, unit_price, line_total, decision, reason, paypal_order_id, transaction_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'BOUGHT', 'Purchased via PayPal Sandbox', ?, ?, datetime('now'))
      `).run(runId, item.product_id, item.name, item.qty, item.unit_price, item.line_total, run.paypal_order_id, capture.transaction_id);
    }

    db.prepare("UPDATE runs SET status = 'COMPLETED' WHERE id = ?").run(runId);

    const ledgerRows = db.prepare('SELECT * FROM ledger WHERE run_id = ?').all(runId);
    console.log('\n--- Step 3: Ledger verification ---');
    console.log('Ledger rows for this run:', ledgerRows);
    console.log('\n✅ End-to-end flow completed successfully!');
  }
}

testFullFlow().catch(console.error);
