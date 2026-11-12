const OpenAI = require('openai');
const db = require('./db');
const { catalog, checkMandate } = require('./mandate');
const { createOrder } = require('./paypal');

// Initialize OpenAI client pointing to Groq, xAI, or custom OpenAI-compatible endpoint
function getAIClient() {
  const groqKey = process.env.GROQ_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;
  const genericKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;

  if (groqKey) {
    const baseURL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    let model = process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b';
    // Normalize model ID for Groq if namespace is omitted
    if (model === 'gpt-oss-120b' || model === 'gpt-oss-20b') {
      model = `openai/${model}`;
    }
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL }),
      model
    };
  }

  if (xaiKey) {
    const baseURL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';
    const model = process.env.XAI_MODEL || 'grok-3-mini';
    return {
      client: new OpenAI({ apiKey: xaiKey, baseURL }),
      model
    };
  }

  if (genericKey) {
    const baseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    return {
      client: new OpenAI({ apiKey: genericKey, baseURL }),
      model
    };
  }

  throw new Error('No LLM API key configured. Please set GROQ_API_KEY in your .env file.');
}

// Tool definitions for function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description: 'Search the product catalog by need or keyword (e.g. "milk", "rice", "dish soap", "cleaning"). Returns product details including computed unit price and stock.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Item or category keyword to search for'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_mandate',
      description: 'Verifies a proposed basket against the user spending mandate. Returns status (ALLOWED, NEEDS_APPROVAL, or BLOCKED), reasons, and basket total.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of items in the proposed cart',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string', description: 'Product ID from catalog' },
                qty: { type: 'integer', description: 'Quantity needed (1-5)' }
              },
              required: ['product_id', 'qty']
            }
          }
        },
        required: ['items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: 'Asks the user a clarifying question or requests approval when an item is ambiguous, missing, or basket total exceeds auto-approve threshold.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question or confirmation message to ask the user'
          },
          options: {
            type: 'array',
            description: 'Optional list of quick choices for the user',
            items: { type: 'string' }
          }
        },
        required: ['question']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_paypal_order',
      description: 'Initiates a PayPal sandbox order for the approved basket. Automatically verifies mandate guardrails before creating the order.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Final approved list of items to purchase',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string', description: 'Product ID from catalog' },
                qty: { type: 'integer', description: 'Quantity to purchase' }
              },
              required: ['product_id', 'qty']
            }
          }
        },
        required: ['items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_to_ledger',
      description: 'Logs an item-level decision to the audit ledger.',
      parameters: {
        type: 'object',
        properties: {
          product_id: { type: 'string', description: 'Catalog product ID or placeholder' },
          name: { type: 'string', description: 'Product name or requested item name' },
          qty: { type: 'integer', description: 'Quantity' },
          decision: {
            type: 'string',
            enum: ['BOUGHT', 'SUBSTITUTED', 'BLOCKED', 'SKIPPED', 'APPROVED_BY_USER', 'DENIED_BY_USER'],
            description: 'Decision outcome for this item'
          },
          reason: { type: 'string', description: 'Reason for the decision' }
        },
        required: ['product_id', 'name', 'qty', 'decision', 'reason']
      }
    }
  }
];

const SYSTEM_PROMPT = `You are a household restock agent. Fill the user's shopping list within their spending mandate.

Core Philosophy: The AI proposes, the code decides. Server code enforces all financial guardrails.

CRITICAL WORKFLOW RULES:
1. Search catalog for needed items (compare options, unit prices, pack sizes, stock).
2. Substitute cheaper options for items that exceed per-item cap ($6) or are out of stock. Drop or skip items that are in forbidden categories (e.g., electronics).
3. Call check_mandate on the proposed basket.
4. If check_mandate returns BLOCKED: inspect the reasons, fix the offending lines (substitute or remove), and call check_mandate again.
5. If check_mandate returns NEEDS_APPROVAL: call ask_user with the basket summary and total.
6. If check_mandate returns ALLOWED: IMMEDIATELY call create_paypal_order with the basket items! DO NOT wait and DO NOT call log_to_ledger for bought items (the server records bought items automatically upon payment capture).
7. Only call log_to_ledger for items that were SUBSTITUTED, BLOCKED, or SKIPPED.
8. Finish with a clear summary of what was ordered, what was substituted, and what was blocked/skipped.`;

/**
 * Execute a single tool call on the server.
 */
async function executeTool({ name, args, runId, mandate, dryRun = false }) {
  if (name === 'search_catalog') {
    const q = (args.query || '').toLowerCase().trim();
    const results = catalog
      .filter(p => {
        return (
          p.need.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      })
      .map(p => ({
        ...p,
        unit_price: +(p.price / (p.size || 1)).toFixed(3)
      }));
    return { results, count: results.length };
  }

  if (name === 'check_mandate') {
    const result = checkMandate(args.items || [], mandate, db);
    if (result.status === 'ALLOWED' && result.items_detail && result.items_detail.length > 0) {
      try {
        db.prepare("UPDATE runs SET cart_json = ? WHERE id = ?").run(JSON.stringify(result.items_detail), runId);
      } catch (e) {
        console.warn('Failed to save cart_json:', e.message);
      }
    }
    return result;
  }

  if (name === 'ask_user') {
    return {
      status: 'AWAITING_USER',
      question: args.question,
      options: args.options || []
    };
  }

  if (name === 'create_paypal_order') {
    // Re-verify mandate rules inside create_paypal_order (defense in depth)
    const verification = checkMandate(args.items || [], mandate, db);
    if (verification.status === 'BLOCKED') {
      return {
        error: 'Mandate verification failed: Order cannot be created.',
        reasons: verification.reasons
      };
    }

    if (dryRun) {
      return {
        order_id: `mock_order_${Date.now()}`,
        status: 'CREATED',
        approve_url: `https://sandbox.paypal.com/checkoutnow?token=mock_${Date.now()}`,
        dry_run: true,
        items: verification.items_detail
      };
    }

    // Call real PayPal Orders API
    const order = await createOrder({
      runId: runId,
      items: verification.items_detail.map(i => ({
        name: i.name,
        quantity: i.qty,
        unit_price: i.unit_price
      }))
    });

    return {
      order_id: order.order_id,
      status: order.status,
      approve_url: order.approve_url,
      items: verification.items_detail
    };
  }

  if (name === 'log_to_ledger') {
    const catalogItem = catalog.find(p => p.id === args.product_id);
    const unitPrice = catalogItem ? catalogItem.price : 0;
    const lineTotal = +(unitPrice * (args.qty || 1)).toFixed(2);

    db.prepare(`
      INSERT INTO ledger (run_id, product_id, name, qty, unit_price, line_total, decision, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      args.product_id || 'unknown',
      args.name || (catalogItem ? catalogItem.name : 'Unknown Item'),
      args.qty || 1,
      unitPrice,
      lineTotal,
      args.decision,
      args.reason,
      new Date().toISOString()
    );

    return { success: true };
  }

  throw new Error(`Unknown tool: ${name}`);
}

/**
 * Run the agent loop for a run row.
 */
async function runAgentLoop({ runId, userText, answerText = null, dryRun = false }) {
  // Fetch current mandate
  const mandate = db.prepare('SELECT * FROM mandates ORDER BY id DESC LIMIT 1').get();
  if (!mandate) {
    throw new Error('No mandate configured.');
  }

  // Fetch or create run row
  let run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId);
  let messages = [];

  if (!run) {
    messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `User restock request:\n<shopping_list>\n${userText}\n</shopping_list>\n\nPlease search the catalog, build a compliant basket, verify with check_mandate, and create an order.`
      }
    ];

    db.prepare(`
      INSERT INTO runs (id, mandate_id, request_text, status, messages_json, cart_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      mandate.id,
      userText,
      'RUNNING',
      JSON.stringify(messages),
      JSON.stringify([]),
      new Date().toISOString()
    );
  } else {
    messages = JSON.parse(run.messages_json || '[]');
    if (answerText) {
      // Append user answer to previous question
      messages.push({
        role: 'user',
        content: `User response to your question: "${answerText}". Please continue fulfilling the shopping list.`
      });
      db.prepare("UPDATE runs SET status = 'RUNNING' WHERE id = ?").run(runId);
    }
  }

  const { client: ai, model: modelName } = getAIClient();
  const MAX_STEPS = 25;
  let stepNo = 0;

  // Retrieve current step count
  const lastStep = db.prepare('SELECT MAX(step_no) as max_step FROM run_steps WHERE run_id = ?').get(runId);
  if (lastStep && lastStep.max_step) {
    stepNo = lastStep.max_step;
  }

  while (stepNo < MAX_STEPS) {
    stepNo++;

    // Call LLM
    const completion = await ai.chat.completions.create({
      model: modelName,
      messages: messages,
      tools: tools,
      tool_choice: 'auto'
    });

    const responseMsg = completion.choices[0].message;
    messages.push(responseMsg);

    // If no tool calls, agent is done with conversation
    if (!responseMsg.tool_calls || responseMsg.tool_calls.length === 0) {
      // Check if we have an approved basket that hasn't had an order created yet!
      const currentRun = db.prepare('SELECT cart_json, paypal_order_id FROM runs WHERE id = ?').get(runId);
      const cart = JSON.parse(currentRun?.cart_json || '[]');

      if (cart.length > 0 && !currentRun?.paypal_order_id) {
        console.log(`[Auto-Create PayPal Order] Cart has ${cart.length} approved items. Generating PayPal Sandbox order for run ${runId}...`);
        const orderResult = await executeTool({
          name: 'create_paypal_order',
          args: { items: cart.map(i => ({ product_id: i.product_id, qty: i.qty })) },
          runId,
          mandate,
          dryRun
        });

        stepNo++;
        db.prepare(`
          INSERT INTO run_steps (run_id, step_no, tool, input_json, output_json, created_at)
          VALUES (?, ?, 'create_paypal_order', ?, ?, ?)
        `).run(
          runId,
          stepNo,
          JSON.stringify({ items: cart.map(i => ({ product_id: i.product_id, qty: i.qty })) }),
          JSON.stringify(orderResult),
          new Date().toISOString()
        );

        if (orderResult.approve_url) {
          db.prepare("UPDATE runs SET status = 'AWAITING_PAYMENT', paypal_order_id = ? WHERE id = ?")
            .run(orderResult.order_id, runId);

          return {
            run_id: runId,
            status: 'AWAITING_PAYMENT',
            approve_url: orderResult.approve_url,
            order_id: orderResult.order_id,
            steps: stepNo
          };
        }
      }

      db.prepare(`
        UPDATE runs
        SET status = 'COMPLETED', messages_json = ?
        WHERE id = ?
      `).run(JSON.stringify(messages), runId);

      return {
        run_id: runId,
        status: 'COMPLETED',
        final_response: responseMsg.content,
        steps: stepNo
      };
    }

    // Execute each tool call
    let shouldPause = false;
    let pendingQuestion = null;
    let approveUrl = null;
    let createdOrderId = null;

    for (const toolCall of responseMsg.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch (err) {
        toolArgs = {};
      }

      const result = await executeTool({
        name: toolName,
        args: toolArgs,
        runId,
        mandate,
        dryRun
      });

      // Log step to run_steps table
      db.prepare(`
        INSERT INTO run_steps (run_id, step_no, tool, input_json, output_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        runId,
        stepNo,
        toolName,
        JSON.stringify(toolArgs),
        JSON.stringify(result),
        new Date().toISOString()
      );

      // Append tool result message
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });

      if (toolName === 'ask_user' || result.status === 'AWAITING_USER') {
        shouldPause = true;
        pendingQuestion = toolArgs.question;
      }

      if (toolName === 'create_paypal_order' && result.approve_url) {
        approveUrl = result.approve_url;
        createdOrderId = result.order_id;
      }
    }

    // Update messages and cart on run row
    db.prepare(`
      UPDATE runs
      SET messages_json = ?
      WHERE id = ?
    `).run(JSON.stringify(messages), runId);

    if (shouldPause) {
      db.prepare(`
        UPDATE runs
        SET status = 'AWAITING_USER'
        WHERE id = ?
      `).run(runId);

      return {
        run_id: runId,
        status: 'AWAITING_USER',
        pending_question: pendingQuestion,
        steps: stepNo
      };
    }

    if (approveUrl) {
      db.prepare(`
        UPDATE runs
        SET status = 'AWAITING_PAYMENT', paypal_order_id = ?
        WHERE id = ?
      `).run(createdOrderId, runId);

      return {
        run_id: runId,
        status: 'AWAITING_PAYMENT',
        approve_url: approveUrl,
        order_id: createdOrderId,
        steps: stepNo
      };
    }
  }

  // If loop exhausted MAX_STEPS, check if we have an approved basket before marking failed
  const currentRun = db.prepare('SELECT cart_json, paypal_order_id FROM runs WHERE id = ?').get(runId);
  const cart = JSON.parse(currentRun?.cart_json || '[]');
  if (cart.length > 0 && !currentRun?.paypal_order_id) {
    console.log(`[Step Limit Reached] Cart has ${cart.length} approved items. Generating PayPal order...`);
    const orderResult = await executeTool({
      name: 'create_paypal_order',
      args: { items: cart.map(i => ({ product_id: i.product_id, qty: i.qty })) },
      runId,
      mandate,
      dryRun
    });

    stepNo++;
    db.prepare(`
      INSERT INTO run_steps (run_id, step_no, tool, input_json, output_json, created_at)
      VALUES (?, ?, 'create_paypal_order', ?, ?, ?)
    `).run(
      runId,
      stepNo,
      JSON.stringify({ items: cart.map(i => ({ product_id: i.product_id, qty: i.qty })) }),
      JSON.stringify(orderResult),
      new Date().toISOString()
    );

    if (orderResult.approve_url) {
      db.prepare("UPDATE runs SET status = 'AWAITING_PAYMENT', paypal_order_id = ? WHERE id = ?")
        .run(orderResult.order_id, runId);

      return {
        run_id: runId,
        status: 'AWAITING_PAYMENT',
        approve_url: orderResult.approve_url,
        order_id: orderResult.order_id,
        steps: stepNo
      };
    }
  }

  // If loop exhausted MAX_STEPS with no valid basket
  db.prepare("UPDATE runs SET status = 'FAILED' WHERE id = ?").run(runId);
  return {
    run_id: runId,
    status: 'FAILED',
    error: 'Maximum step limit reached.',
    steps: stepNo
  };
}

module.exports = {
  tools,
  SYSTEM_PROMPT,
  executeTool,
  runAgentLoop
};
