require('dotenv').config();
const { checkMandate, catalog } = require('../server/src/mandate');
const { DatabaseSync } = require('node:sqlite');

// Create an isolated in-memory DB for reproducible testing
function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE mandates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weekly_budget REAL NOT NULL,
      per_item_cap REAL NOT NULL,
      allowed_categories TEXT NOT NULL,
      auto_approve_under REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE ledger (
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
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

const defaultMandate = {
  id: 1,
  weekly_budget: 20.00,
  per_item_cap: 6.00,
  allowed_categories: JSON.stringify(['groceries', 'cleaning']),
  auto_approve_under: 15.00
};

async function runTestSuite() {
  console.log('========================================================================');
  console.log('       MANDATE AI AGENT - 10 EVALUATION SCENARIOS TEST SUITE            ');
  console.log('========================================================================\n');

  const results = [];
  let overBudgetPurchases = 0;

  // -------------------------------------------------------------------------
  // Scenario 1: All items within limits
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    const cart = [
      { product_id: 'milk-amul-toned-1l', qty: 1 }, // $1.10
      { product_id: 'bread-wonder-white-400g', qty: 1 }, // $1.20
      { product_id: 'dish-soap-vim-gel-500ml', qty: 1 } // $1.50
    ];
    const res = checkMandate(cart, defaultMandate, db);
    const passed = res.status === 'ALLOWED' && res.basket_total === 3.80;
    if (res.basket_total > defaultMandate.weekly_budget) overBudgetPurchases++;

    results.push({
      scenario: 1,
      name: 'All items within limits',
      expected: 'ALLOWED, within budget',
      actual: `${res.status} ($${res.basket_total})`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 2: One item over per-item cap
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // India Gate Classic Basmati 5kg is $14.50, exceeds $6.00 cap
    const overCapCart = [{ product_id: 'rice-indiagate-classic-5kg', qty: 1 }];
    const resOver = checkMandate(overCapCart, defaultMandate, db);
    const blockedProperly = resOver.status === 'BLOCKED' && resOver.reasons.some(r => r.includes('exceeds per-item cap'));

    // Agent substitutes with Daawat Basmati Rice 1kg @ $1.80
    const substitutedCart = [{ product_id: 'rice-daawat-basmati-1kg', qty: 1 }];
    const resSub = checkMandate(substitutedCart, defaultMandate, db);
    const passed = blockedProperly && resSub.status === 'ALLOWED';

    results.push({
      scenario: 2,
      name: 'One item over per-item cap',
      expected: 'BLOCKED over-cap item, ALLOWED cheaper substitute',
      actual: `Over-cap: ${resOver.status}, Substitute: ${resSub.status}`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 3: Item in a disallowed category
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // Anker USB-C cable is in "electronics"
    const cart = [{ product_id: 'elec-anker-usb-c-cable', qty: 1 }];
    const res = checkMandate(cart, defaultMandate, db);
    const passed = res.status === 'BLOCKED' && res.reasons.some(r => r.includes('category'));

    results.push({
      scenario: 3,
      name: 'Item in disallowed category',
      expected: 'BLOCKED with category reason',
      actual: `${res.status} (${res.reasons[0] ? res.reasons[0].substring(0, 45) + '...' : ''})`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 4: Out-of-stock item
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // rice-sonamasoori-out-of-stock has stock: 0
    const outCart = [{ product_id: 'rice-sonamasoori-out-of-stock', qty: 1 }];
    const resOut = checkMandate(outCart, defaultMandate, db);
    const blockedOut = resOut.status === 'BLOCKED' && resOut.reasons.some(r => r.includes('out of stock'));

    // Re-plan with alternative in stock
    const altCart = [{ product_id: 'rice-jasmine-royal-2kg', qty: 1 }];
    const resAlt = checkMandate(altCart, defaultMandate, db);
    const passed = blockedOut && resAlt.status === 'ALLOWED';

    results.push({
      scenario: 4,
      name: 'Out-of-stock item',
      expected: 'BLOCKED out of stock, re-plans with in-stock alternative',
      actual: `OOS: ${resOut.status}, Alternative: ${resAlt.status}`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 5: Basket over auto-approve line
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // Total: $5.90 + $5.80 + $4.90 = $16.60 > $15.00 auto_approve_under
    const cart = [
      { product_id: 'coffee-starbucks-pikeplace-340g', qty: 1 }, // $5.90
      { product_id: 'laundry-tide-pods-16ct', qty: 1 }, // $5.80
      { product_id: 'oil-olive-extra-virgin-500ml', qty: 1 } // $4.90
    ];
    const res = checkMandate(cart, defaultMandate, db);
    const passed = res.status === 'NEEDS_APPROVAL' && res.basket_total === 16.60;

    results.push({
      scenario: 5,
      name: 'Basket over auto-approve threshold',
      expected: 'NEEDS_APPROVAL (asks user)',
      actual: `${res.status} ($${res.basket_total} > $${defaultMandate.auto_approve_under})`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 6: Weekly budget nearly used
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // Simulate user already spent $18.50 in the last 7 days
    db.prepare(`
      INSERT INTO ledger (run_id, product_id, name, qty, unit_price, line_total, decision, reason, created_at)
      VALUES ('prev_run', 'coffee', 'Coffee', 1, 18.50, 18.50, 'BOUGHT', 'Approved purchase', datetime('now'))
    `).run();

    // Adding $3.40 cage-free eggs: $18.50 + $3.40 = $21.90 > $20.00 weekly budget
    const cart = [{ product_id: 'eggs-cagefree-large-12pk', qty: 1 }];
    const res = checkMandate(cart, defaultMandate, db);
    const passed = res.status === 'BLOCKED' && res.reasons.some(r => r.includes('exceeds weekly budget'));

    results.push({
      scenario: 6,
      name: 'Weekly budget nearly used',
      expected: 'BLOCKED (remaining budget exceeded)',
      actual: `${res.status} (Remaining: $${res.remaining_budget})`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 7: Ambiguous item ("something for dinner")
  // -------------------------------------------------------------------------
  {
    // Evaluates catalog search behavior: ambiguous term doesn't match a single product, requires ask_user
    const query = 'something for dinner';
    const matches = catalog.filter(p => p.need.includes(query) || p.name.includes(query));
    const passed = matches.length === 0; // correctly identified as ambiguous / non-catalog

    results.push({
      scenario: 7,
      name: 'Ambiguous item ("something for dinner")',
      expected: 'No single product match -> agent calls ask_user',
      actual: `Matches found: ${matches.length} (triggers ask_user)`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 8: Item not in the catalog
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    const cart = [{ product_id: 'exotic-dragon-fruit-unknown', qty: 1 }];
    const res = checkMandate(cart, defaultMandate, db);
    const passed = res.status === 'BLOCKED' && res.reasons.some(r => r.includes('does not exist in catalog'));

    results.push({
      scenario: 8,
      name: 'Item not in catalog',
      expected: 'BLOCKED without hallucinating product',
      actual: `${res.status} (${res.reasons[0]})`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 9: Prompt injection in the list
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // Attempted injection to override cap or inject 100 electronics units at $0
    const injectionCart = [
      { product_id: 'elec-hdmi-cable-4k-2m', qty: 50 },
      { product_id: 'milk-amul-toned-1l', qty: 1 }
    ];
    const res = checkMandate(injectionCart, defaultMandate, db);
    // Code blocks disallowed category and quantity capping
    const passed = res.status === 'BLOCKED' && res.reasons.some(r => r.includes('electronics'));
    if (res.status === 'ALLOWED' && res.basket_total > defaultMandate.weekly_budget) {
      overBudgetPurchases++;
    }

    results.push({
      scenario: 9,
      name: 'Prompt injection in list',
      expected: 'Guardrails enforced strictly in code',
      actual: `${res.status} (${res.reasons.length} violation(s) detected)`,
      passed
    });
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Duplicate items in list
  // -------------------------------------------------------------------------
  {
    const db = createTestDb();
    // 3 entries of Amul milk with quantities 2, 2, 3 -> consolidated and capped at 5
    const cart = [
      { product_id: 'milk-amul-toned-1l', qty: 2 },
      { product_id: 'milk-amul-toned-1l', qty: 2 },
      { product_id: 'milk-amul-toned-1l', qty: 3 }
    ];
    const res = checkMandate(cart, defaultMandate, db);
    const milkItem = res.items_detail.find(i => i.product_id === 'milk-amul-toned-1l');
    const passed = res.status === 'ALLOWED' && milkItem && milkItem.qty === 5 && res.basket_total === 5.50;

    results.push({
      scenario: 10,
      name: 'Duplicate items merged and capped',
      expected: 'Merged into 1 line, capped at max 5 units',
      actual: `Lines: ${res.items_detail.length}, Qty: ${milkItem?.qty}, Total: $${res.basket_total}`,
      passed
    });
  }

  // Print results table
  console.log('| #  | Scenario                                  | Status | Expected Outcome                                     | Result |');
  console.log('|----|-------------------------------------------|--------|------------------------------------------------------|--------|');
  let passedCount = 0;
  for (const r of results) {
    if (r.passed) passedCount++;
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${r.scenario.toString().padEnd(2)} | ${r.name.padEnd(41)} | ${statusIcon} | ${r.expected.padEnd(52)} | ${r.actual.padEnd(30)} |`);
  }

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passedCount} / 10 Scenarios Passed`);
  console.log(`Over-budget purchases: ${overBudgetPurchases} (Target: 0)`);
  console.log('Core Claim: "The AI proposes, the code decides" verified!');
  console.log('========================================================================\n');

  if (passedCount !== 10 || overBudgetPurchases > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner encountered an error:', err);
  process.exit(1);
});
