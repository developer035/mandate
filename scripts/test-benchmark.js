require('dotenv').config();
const { runAgentLoop } = require('../server/src/agent');
const db = require('../server/src/db');

async function testBenchmark() {
  const runId = 'test_benchmark_' + Date.now();
  console.log('Testing benchmark prompt with new auto-create logic...');
  const res = await runAgentLoop({
    runId,
    userText: 'I need 2L milk, 2kg rice, and dish soap',
    dryRun: false
  });

  console.log('\n--- RESULT ---');
  console.log(res);

  const run = db.prepare('SELECT id, status, paypal_order_id FROM runs WHERE id = ?').get(runId);
  console.log('DB Run status:', run);

  const steps = db.prepare('SELECT step_no, tool FROM run_steps WHERE run_id = ?').all(runId);
  console.log('Steps recorded:', steps);
}

testBenchmark().catch(console.error);
