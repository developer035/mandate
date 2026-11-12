const catalog = require('./catalog.json');

// Create a fast lookup map of products by ID
const catalogMap = new Map();
for (const product of catalog) {
  catalogMap.set(product.id, product);
}

/**
 * Pure function to check a proposed cart against a spending mandate.
 * ALL money calculations happen here using trusted catalog data.
 * The model NEVER supplies prices or totals.
 *
 * @param {Array<{product_id: string, qty: number}>} cartItems
 * @param {Object} mandate
 * @param {Object} db - SQLite database instance
 * @returns {Object} { status: 'ALLOWED'|'NEEDS_APPROVAL'|'BLOCKED', reasons: string[], basket_total: number, remaining_budget: number, offending_lines: Array, items_detail: Array }
 */
function checkMandate(cartItems, mandate, db) {
  const reasons = [];
  const offendingLines = [];
  const itemsDetail = [];
  let basketTotal = 0;

  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      status: 'BLOCKED',
      reasons: ['Cart is empty.'],
      basket_total: 0,
      remaining_budget: 0,
      offending_lines: [],
      items_detail: []
    };
  }

  // Guardrail: maximum lines in basket
  if (cartItems.length > 15) {
    return {
      status: 'BLOCKED',
      reasons: ['Cart exceeds maximum allowed line items (15).'],
      basket_total: 0,
      remaining_budget: 0,
      offending_lines: cartItems.slice(15),
      items_detail: []
    };
  }

  // Parse allowed categories
  let allowedCategories = mandate.allowed_categories;
  if (typeof allowedCategories === 'string') {
    try {
      allowedCategories = JSON.parse(allowedCategories);
    } catch {
      allowedCategories = allowedCategories.split(',').map(s => s.trim().toLowerCase());
    }
  }
  const allowedSet = new Set(allowedCategories.map(c => c.toLowerCase()));

  // Consolidate duplicate items in the list if any
  const mergedMap = new Map();
  for (const item of cartItems) {
    const pId = item.product_id;
    const requestedQty = Math.min(Math.max(1, parseInt(item.qty || 1, 10)), 5); // cap per line at 5
    if (mergedMap.has(pId)) {
      const existing = mergedMap.get(pId);
      existing.qty = Math.min(existing.qty + requestedQty, 5); // max 5 per product
    } else {
      mergedMap.set(pId, { product_id: pId, qty: requestedQty });
    }
  }

  const consolidatedItems = Array.from(mergedMap.values());

  // Check each product against hard limits
  for (const line of consolidatedItems) {
    const product = catalogMap.get(line.product_id);

    if (!product) {
      reasons.push(`Product '${line.product_id}' does not exist in catalog.`);
      offendingLines.push(line);
      continue;
    }

    if (product.stock <= 0) {
      reasons.push(`Product '${product.name}' is out of stock.`);
      offendingLines.push(line);
      continue;
    }

    if (line.qty > product.stock) {
      reasons.push(`Requested quantity (${line.qty}) for '${product.name}' exceeds available stock (${product.stock}).`);
      offendingLines.push(line);
      continue;
    }

    if (!allowedSet.has(product.category.toLowerCase())) {
      reasons.push(`Product '${product.name}' is in category '${product.category}', which is not in allowed categories (${Array.from(allowedSet).join(', ')}).`);
      offendingLines.push(line);
      continue;
    }

    if (product.price > mandate.per_item_cap) {
      reasons.push(`Product '${product.name}' unit price ($${product.price.toFixed(2)}) exceeds per-item cap of $${mandate.per_item_cap.toFixed(2)}.`);
      offendingLines.push(line);
      continue;
    }

    const lineTotal = +(product.price * line.qty).toFixed(2);
    basketTotal = +(basketTotal + lineTotal).toFixed(2);

    itemsDetail.push({
      product_id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      unit_price: product.price,
      qty: line.qty,
      line_total: lineTotal
    });
  }

  // Calculate spent this week from the ledger
  let spentThisWeek = 0;
  if (db) {
    try {
      const row = db.prepare(`
        SELECT SUM(line_total) as spent
        FROM ledger
        WHERE decision = 'BOUGHT'
          AND created_at >= datetime('now', '-7 days')
      `).get();
      if (row && row.spent) {
        spentThisWeek = parseFloat(row.spent) || 0;
      }
    } catch (e) {
      console.warn('Could not query weekly spent from ledger:', e.message);
    }
  }

  const remainingBudget = Math.max(0, +(mandate.weekly_budget - spentThisWeek).toFixed(2));

  // Check weekly budget constraint
  if (basketTotal + spentThisWeek > mandate.weekly_budget) {
    reasons.push(`Basket total ($${basketTotal.toFixed(2)}) + spent this week ($${spentThisWeek.toFixed(2)}) exceeds weekly budget of $${mandate.weekly_budget.toFixed(2)}. Remaining budget: $${remainingBudget.toFixed(2)}.`);
  }

  // Determine overall status
  let status = 'ALLOWED';
  if (reasons.length > 0) {
    status = 'BLOCKED';
  } else if (basketTotal > mandate.auto_approve_under) {
    status = 'NEEDS_APPROVAL';
    reasons.push(`Basket total ($${basketTotal.toFixed(2)}) exceeds auto-approve limit of $${mandate.auto_approve_under.toFixed(2)}. User approval required.`);
  }

  return {
    status,
    reasons,
    basket_total: basketTotal,
    spent_this_week: spentThisWeek,
    remaining_budget: remainingBudget,
    offending_lines: offendingLines,
    items_detail: itemsDetail
  };
}

module.exports = {
  catalog,
  catalogMap,
  checkMandate
};
