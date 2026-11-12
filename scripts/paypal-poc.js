require('dotenv').config();
const readline = require('node:readline');
const { getAccessToken, createOrder, captureOrder } = require('../server/src/paypal');

async function main() {
  console.log('========================================================');
  console.log('       PayPal Sandbox Proof of Concept (PoC) Script     ');
  console.log('========================================================\n');

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
    console.error('❌ Missing credentials in .env!');
    console.error('Please configure PAYPAL_CLIENT_ID and PAYPAL_SECRET in your .env file.\n');
    process.exit(1);
  }

  try {
    console.log('Step 1: Requesting OAuth2 Access Token from PayPal Sandbox...');
    const token = await getAccessToken();
    console.log('✅ Access Token obtained successfully! (Token length:', token.length, 'chars)\n');

    console.log('Step 2: Creating a test checkout order ($2.20 for 2x Amul Toned Milk)...');
    const order = await createOrder({
      runId: 'poc_test_run',
      items: [
        {
          name: 'Amul Toned Milk',
          quantity: 2,
          unit_price: 1.10
        }
      ]
    });

    console.log('✅ Order created successfully!');
    console.log('   Order ID:   ', order.order_id);
    console.log('   Status:     ', order.status);
    console.log('   Approve URL:', order.approve_url);
    console.log('\n--------------------------------------------------------');
    console.log('👉 Please open the Approve URL in your browser:');
    console.log(`   ${order.approve_url}`);
    console.log('👉 Log in with your PayPal Sandbox Personal (Buyer) account and click Pay/Approve.');
    console.log('--------------------------------------------------------\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Once you have approved the payment in your browser, press ENTER to capture: ', async () => {
      rl.close();
      console.log('\nStep 3: Capturing order', order.order_id, '...');
      try {
        const result = await captureOrder(order.order_id);
        console.log('🎉 PAYMENT CAPTURED SUCCESSFULLY!');
        console.log('   Capture Status:  ', result.status);
        console.log('   Transaction ID:  ', result.transaction_id);
        console.log('   Captured Amount: $', result.amount);
        console.log('\n✅ PayPal integration is verified and working perfectly!');
      } catch (err) {
        console.error('❌ Capture failed:', err.message);
      }
    });

  } catch (err) {
    console.error('❌ Error during PayPal test:', err.message);
  }
}

main();
