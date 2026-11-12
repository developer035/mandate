require('dotenv').config();

const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get cached or new OAuth2 access token from PayPal sandbox.
 */
async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_SECRET is missing in environment variables.');
  }

  // Check cache (refresh if within 60s of expiring)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal OAuth failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

/**
 * Create a PayPal checkout order (intent: CAPTURE).
 * items: Array of { name, quantity, unit_price }
 */
async function createOrder({ runId, items, returnUrl, cancelUrl }) {
  // Compute item total ensuring strict 2-decimal arithmetic
  let sum = 0;
  const paypalItems = items.map(item => {
    const qty = parseInt(item.quantity || item.qty, 10);
    const unitPrice = parseFloat(item.unit_price || item.price);
    const lineTotal = +(qty * unitPrice).toFixed(2);
    sum += lineTotal;

    return {
      name: item.name.substring(0, 127),
      quantity: qty.toString(),
      unit_amount: {
        currency_code: 'USD',
        value: unitPrice.toFixed(2)
      },
      category: 'PHYSICAL_GOODS'
    };
  });

  const totalStr = sum.toFixed(2);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  // Fallback to simulated PayPal sandbox checkout if credentials not yet configured
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    const simOrderId = `SANDBOX_ORDER_${Date.now()}`;
    return {
      order_id: simOrderId,
      status: 'CREATED',
      approve_url: `${baseUrl}/paypal/simulate?token=${simOrderId}&total=${totalStr}`
    };
  }

  const token = await getAccessToken();
  const effectiveReturnUrl = returnUrl || `${baseUrl}/paypal/return`;
  const effectiveCancelUrl = cancelUrl || `${baseUrl}/paypal/cancel`;

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: runId || `run_${Date.now()}`,
        amount: {
          currency_code: 'USD',
          value: totalStr,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: totalStr
            }
          }
        },
        items: paypalItems
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          return_url: effectiveReturnUrl,
          cancel_url: effectiveCancelUrl,
          user_action: 'PAY_NOW'
        }
      }
    }
  };

  const requestId = `req_order_${runId || Date.now()}_${Date.now()}`;

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal createOrder failed (${res.status}): ${JSON.stringify(data)}`);
  }

  // Find approve link
  const approveLink = data.links?.find(l => l.rel === 'payer-action' || l.rel === 'approve');
  const approveUrl = approveLink ? approveLink.href : null;

  return {
    order_id: data.id,
    status: data.status,
    approve_url: approveUrl,
    links: data.links
  };
}

/**
 * Capture payment for an approved order.
 */
async function captureOrder(orderId) {
  if (orderId && orderId.startsWith('SANDBOX_ORDER_')) {
    return {
      status: 'COMPLETED',
      order_id: orderId,
      transaction_id: `SANDBOX_TX_${Date.now().toString(36).toUpperCase()}`,
      amount: '0.00'
    };
  }

  const token = await getAccessToken();
  const requestId = `req_cap_${orderId}_${Date.now()}`;

  const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId
    }
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal captureOrder failed (${res.status}): ${JSON.stringify(data)}`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  const transactionId = capture?.id || data.id;

  return {
    status: data.status,
    order_id: data.id,
    transaction_id: transactionId,
    amount: capture?.amount?.value,
    raw: data
  };
}

module.exports = {
  getAccessToken,
  createOrder,
  captureOrder
};
