const express = require('express');
const router = express.Router();
const db = require('../db');
const { runAgentLoop } = require('../agent');

/**
 * POST /run
 * Starts a new agent restock run.
 */
router.post('/', async (req, res) => {
  try {
    const { text, dry_run = false } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Request text is required.' });
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Kick off agent loop asynchronously
    runAgentLoop({
      runId,
      userText: text.trim(),
      dryRun: Boolean(dry_run)
    }).catch(err => {
      console.error(`Error in background agent loop for ${runId}:`, err);
      try {
        db.prepare("UPDATE runs SET status = 'FAILED' WHERE id = ?").run(runId);
      } catch (e) {
        // ignore
      }
    });

    res.status(202).json({
      run_id: runId,
      status: 'RUNNING',
      message: 'Agent run initiated.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /run/:id
 * Poll status, steps, pending questions, and PayPal URLs for a run.
 */
router.get('/:id', (req, res) => {
  try {
    const runId = req.params.id;
    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found.' });
    }

    const steps = db.prepare(`
      SELECT step_no, tool, input_json, output_json, created_at
      FROM run_steps
      WHERE run_id = ?
      ORDER BY step_no ASC, id ASC
    `).all(runId).map(s => ({
      step_no: s.step_no,
      tool: s.tool,
      input: JSON.parse(s.input_json || '{}'),
      output: JSON.parse(s.output_json || '{}'),
      created_at: s.created_at
    }));

    // Find pending question if waiting for user
    let pendingQuestion = null;
    let pendingOptions = [];
    if (run.status === 'AWAITING_USER') {
      const lastAskStep = steps.slice().reverse().find(s => s.tool === 'ask_user');
      if (lastAskStep) {
        pendingQuestion = lastAskStep.input.question;
        pendingOptions = lastAskStep.input.options || [];
      }
    }

    // Find approve URL if waiting for PayPal
    let approveUrl = null;
    if (run.status === 'AWAITING_PAYMENT') {
      const lastOrderStep = steps.slice().reverse().find(s => s.tool === 'create_paypal_order');
      if (lastOrderStep && lastOrderStep.output.approve_url) {
        approveUrl = lastOrderStep.output.approve_url;
      }
    }

    // Find latest basket check detail
    let latestBasket = null;
    const lastCheckStep = steps.slice().reverse().find(s => s.tool === 'check_mandate');
    if (lastCheckStep && lastCheckStep.output) {
      latestBasket = lastCheckStep.output;
    }

    res.json({
      id: run.id,
      status: run.status,
      request_text: run.request_text,
      paypal_order_id: run.paypal_order_id,
      pending_question: pendingQuestion,
      pending_options: pendingOptions,
      approve_url: approveUrl,
      latest_basket: latestBasket,
      steps: steps,
      created_at: run.created_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /run/:id/answer
 * Provide user response to an ask_user question or approve/deny prompt.
 */
router.post('/:id/answer', async (req, res) => {
  try {
    const runId = req.params.id;
    const { answer } = req.body;

    const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found.' });
    }

    if (answer && (answer.toLowerCase() === 'deny' || answer.toLowerCase() === 'no')) {
      db.prepare("UPDATE runs SET status = 'DENIED' WHERE id = ?").run(runId);
      return res.json({ status: 'DENIED', run_id: runId });
    }

    // Resume agent loop in background
    runAgentLoop({
      runId,
      userText: run.request_text,
      answerText: answer || 'Approved by user'
    }).catch(err => {
      console.error(`Error in resuming agent loop for ${runId}:`, err);
      try {
        db.prepare("UPDATE runs SET status = 'FAILED' WHERE id = ?").run(runId);
      } catch (e) {
        // ignore
      }
    });

    res.json({
      status: 'RESUMED',
      run_id: runId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
