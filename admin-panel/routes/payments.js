const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Helper to get setting
const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
};

// Activate device license after successful payment
function activateDeviceLicense(deviceId, packageId) {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
  if (!pkg) return;

  let expiresAt = null;
  if (pkg.license_type === 'yearly') {
    const d = new Date();
    d.setDate(d.getDate() + (pkg.duration_days || 365));
    expiresAt = d.toISOString().split('T')[0];
  }

  db.prepare('UPDATE devices SET license_type = ?, license_expires_at = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
    .run(pkg.license_type, expiresAt, 'active', deviceId);
}

// List payments (admin - requires auth)
router.get('/', authMiddleware, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
  const payments = db.prepare(`
    SELECT p.*, d.mac_address, d.name as device_name, pkg.name as package_name
    FROM payments p
    LEFT JOIN devices d ON p.device_id = d.id
    LEFT JOIN packages pkg ON p.package_id = pkg.id
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({ payments, total, page, totalPages: Math.ceil(total / limit) });
});

// Get available packages for a device (public - for payment page)
router.get('/checkout/:device_id', (req, res) => {
  const device = db.prepare('SELECT id, mac_address, name, license_type FROM devices WHERE id = ?').get(req.params.device_id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const packages = db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC').all();
  const stripeEnabled = getSetting('stripe_enabled') === 'true';
  const mollieEnabled = getSetting('mollie_enabled') === 'true';

  res.json({ device, packages, payment_providers: { stripe: stripeEnabled, mollie: mollieEnabled } });
});

// Create Stripe checkout session
router.post('/stripe/create-checkout', async (req, res) => {
  const stripeKey = getSetting('stripe_secret_key');
  if (!stripeKey) return res.status(400).json({ error: 'Stripe is not configured' });

  const { device_id, package_id } = req.body;
  if (!device_id || !package_id) return res.status(400).json({ error: 'device_id and package_id required' });

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(device_id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(package_id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  try {
    const stripe = require('stripe')(stripeKey);
    const baseUrl = req.headers.origin || `http://localhost:${process.env.PORT || 3001}`;

    // Create payment record
    const payment = db.prepare(
      'INSERT INTO payments (device_id, package_id, amount, currency, provider, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(device_id, package_id, pkg.price, pkg.currency, 'stripe', 'pending');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: pkg.currency.toLowerCase(),
          product_data: {
            name: pkg.name,
            description: `${pkg.description} - Device: ${device.mac_address}`,
          },
          unit_amount: Math.round(pkg.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
      metadata: {
        payment_id: payment.lastInsertRowid.toString(),
        device_id: device_id.toString(),
        package_id: package_id.toString(),
      },
    });

    // Store stripe session ID
    db.prepare('UPDATE payments SET provider_payment_id = ? WHERE id = ?').run(session.id, payment.lastInsertRowid);

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (e) {
    res.status(500).json({ error: 'Stripe error: ' + e.message });
  }
});

// Stripe webhook
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const stripeKey = getSetting('stripe_secret_key');
  const webhookSecret = getSetting('stripe_webhook_secret');
  if (!stripeKey) return res.status(400).send('Stripe not configured');

  try {
    const stripe = require('stripe')(stripeKey);
    let event;

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { payment_id, device_id, package_id } = session.metadata || {};

      if (payment_id) {
        db.prepare('UPDATE payments SET status = ?, provider_payment_id = ? WHERE id = ?')
          .run('completed', session.id, parseInt(payment_id));
        activateDeviceLicense(parseInt(device_id), parseInt(package_id));
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook error:', e.message);
    res.status(400).send('Webhook error');
  }
});

// Create Mollie payment
router.post('/mollie/create-payment', async (req, res) => {
  const mollieKey = getSetting('mollie_api_key');
  if (!mollieKey) return res.status(400).json({ error: 'Mollie is not configured' });

  const { device_id, package_id } = req.body;
  if (!device_id || !package_id) return res.status(400).json({ error: 'device_id and package_id required' });

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(device_id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND is_active = 1').get(package_id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  try {
    const baseUrl = req.headers.origin || `http://localhost:${process.env.PORT || 3001}`;

    // Create payment record
    const paymentRecord = db.prepare(
      'INSERT INTO payments (device_id, package_id, amount, currency, provider, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(device_id, package_id, pkg.price, pkg.currency, 'mollie', 'pending');

    // Mollie API call
    const axios = require('axios');
    const mollieRes = await axios.post('https://api.mollie.com/v2/payments', {
      amount: { currency: pkg.currency, value: pkg.price.toFixed(2) },
      description: pkg.mollie_description || `${pkg.name} - Device: ${device.mac_address}`,
      redirectUrl: `${baseUrl}/payment/success`,
      webhookUrl: `${baseUrl}/api/payments/mollie/webhook`,
      metadata: {
        payment_id: paymentRecord.lastInsertRowid.toString(),
        device_id: device_id.toString(),
        package_id: package_id.toString(),
      },
    }, {
      headers: { 'Authorization': `Bearer ${mollieKey}`, 'Content-Type': 'application/json' },
    });

    const molliePayment = mollieRes.data;
    db.prepare('UPDATE payments SET provider_payment_id = ? WHERE id = ?').run(molliePayment.id, paymentRecord.lastInsertRowid);

    res.json({ checkout_url: molliePayment._links.checkout.href, payment_id: molliePayment.id });
  } catch (e) {
    const msg = e.response?.data?.detail || e.message;
    res.status(500).json({ error: 'Mollie error: ' + msg });
  }
});

// Mollie webhook
router.post('/mollie/webhook', async (req, res) => {
  const mollieKey = getSetting('mollie_api_key');
  if (!mollieKey) return res.status(400).send('Mollie not configured');

  const { id } = req.body;
  if (!id) return res.status(400).send('Missing payment ID');

  try {
    const axios = require('axios');
    const mollieRes = await axios.get(`https://api.mollie.com/v2/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${mollieKey}` },
    });

    const molliePayment = mollieRes.data;
    const { payment_id, device_id, package_id } = molliePayment.metadata || {};

    if (molliePayment.status === 'paid' && payment_id) {
      db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('completed', parseInt(payment_id));
      activateDeviceLicense(parseInt(device_id), parseInt(package_id));
    } else if (['failed', 'canceled', 'expired'].includes(molliePayment.status) && payment_id) {
      db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('failed', parseInt(payment_id));
    }

    res.send('OK');
  } catch (e) {
    console.error('Mollie webhook error:', e.message);
    res.status(500).send('Error');
  }
});

module.exports = router;
