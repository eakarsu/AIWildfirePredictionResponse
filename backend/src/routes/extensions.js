// =============================================================================
// extensions.js — Apply pass 5: ALL remaining backlog
// =============================================================================
// Implements remaining backlog items from _AUDIT_NOTE.md (capped at 5 features):
//   1. Damage severity prediction (TOO-RISKY/vision)
//        Text-only AI fallback gated on OPENROUTER_API_KEY. No image upload
//        is required; the workflow accepts pre-extracted observations.
//   2. Mutual-aid resource requests (NEEDS-PRODUCT-DECISION)
//        PRODUCT-DECISION: status-machine of [drafted|sent|accepted|declined|fulfilled]
//        with no live cross-agency API. Requests are recorded in DB; a future
//        integration can flip an outbound flag.
//   3. Insurance claim support (NEEDS-CREDS)
//        env: INSURANCE_API_BASE, INSURANCE_API_KEY
//   4. Real-time dispatch (NEEDS-PRODUCT-DECISION)
//        PRODUCT-DECISION: poll-based, additive 'dispatch_orders' table.
//   5. Radio / communication integration (NEEDS-CREDS)
//        env: RADIO_GATEWAY_URL, RADIO_GATEWAY_TOKEN
// =============================================================================

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');

let __bootstrapped = false;
async function bootstrap(pool) {
  if (__bootstrapped) return;
  __bootstrapped = true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS damage_severity_predictions (
        id SERIAL PRIMARY KEY,
        fire_id INTEGER,
        observations JSONB,
        prediction JSONB,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mutual_aid_requests (
        id SERIAL PRIMARY KEY,
        requesting_agency VARCHAR(255),
        target_agency VARCHAR(255),
        resource_type VARCHAR(64),
        quantity INTEGER,
        priority VARCHAR(32),
        status VARCHAR(32) DEFAULT 'drafted',
        notes TEXT,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS insurance_claims (
        id SERIAL PRIMARY KEY,
        fire_id INTEGER,
        property_address TEXT,
        policy_number VARCHAR(128),
        carrier VARCHAR(128),
        damage_estimate NUMERIC(14,2),
        status VARCHAR(32) DEFAULT 'submitted',
        external_ref VARCHAR(255),
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dispatch_orders (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER,
        unit_id VARCHAR(64),
        action VARCHAR(64),
        eta_minutes INTEGER,
        status VARCHAR(32) DEFAULT 'queued',
        details JSONB,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS radio_messages (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(64),
        from_unit VARCHAR(64),
        to_unit VARCHAR(64),
        body TEXT,
        priority VARCHAR(16) DEFAULT 'normal',
        delivered BOOLEAN DEFAULT FALSE,
        external_ref VARCHAR(255),
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('extensions bootstrap error:', err.message);
  }
}

// Run bootstrap lazily on first request when pool is available via app.locals.
router.use((req, res, next) => {
  const pool = req.app.locals.pool;
  if (pool) bootstrap(pool);
  next();
});

const axios = require('axios');
async function callAI(systemPrompt, userPrompt) {
  const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1500,
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const data = r.data;
  if (data.error) throw new Error(data.error.message || 'OpenRouter error');
  const content = data.choices[0].message.content;
  try { return JSON.parse(content); } catch (_) {
    const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) try { return JSON.parse(m[1]); } catch (_) { /* fallthrough */ }
    return { analysis: content };
  }
}

// -----------------------------------------------------------------------------
// 1) Damage severity prediction (TOO-RISKY → text-only)
// -----------------------------------------------------------------------------
router.post('/damage-severity-predict', aiRateLimiter, auth, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });
  }
  try {
    const { fire_id, observations } = req.body || {};
    const sys = 'You are a wildfire damage-severity prediction model. Given pre-extracted ground / aerial observations, return JSON {severity_class: low|moderate|high|catastrophic, structures_at_risk:int, infrastructure_impact:[strings], confidence:float, key_drivers:[strings]}.';
    const u = JSON.stringify({ fire_id: fire_id || null, observations: observations || {} });
    const result = await callAI(sys, u);
    const r = await req.app.locals.pool.query(
      `INSERT INTO damage_severity_predictions (fire_id, observations, prediction, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [parseInt(fire_id, 10) || null, observations || {}, result, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 2) Mutual-aid resource requests (NEEDS-PRODUCT-DECISION)
// -----------------------------------------------------------------------------
router.post('/mutual-aid', auth, async (req, res) => {
  try {
    const { requesting_agency, target_agency, resource_type, quantity, priority, notes } = req.body || {};
    const r = await req.app.locals.pool.query(
      `INSERT INTO mutual_aid_requests (requesting_agency, target_agency, resource_type, quantity, priority, notes, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'sent') RETURNING *`,
      [requesting_agency || 'Unknown', target_agency || 'Adjacent', resource_type || 'engine',
       parseInt(quantity || 1, 10), priority || 'standard', notes || null, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/mutual-aid/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['drafted', 'sent', 'accepted', 'declined', 'fulfilled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const r = await req.app.locals.pool.query(
      `UPDATE mutual_aid_requests SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, parseInt(req.params.id, 10)]
    );
    res.json(r.rows[0] || { error: 'not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mutual-aid', auth, async (req, res) => {
  try {
    const r = await req.app.locals.pool.query(`SELECT * FROM mutual_aid_requests ORDER BY created_at DESC LIMIT 200`);
    res.json({ requests: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 3) Insurance claim support (NEEDS-CREDS)
// -----------------------------------------------------------------------------
function insuranceMissing() {
  const m = [];
  if (!process.env.INSURANCE_API_BASE) m.push('INSURANCE_API_BASE');
  if (!process.env.INSURANCE_API_KEY) m.push('INSURANCE_API_KEY');
  return m;
}

router.post('/insurance/claim', auth, async (req, res) => {
  const missing = insuranceMissing();
  if (missing.length) {
    return res.status(503).json({ error: 'Insurance claims not configured', missing: missing.join(',') });
  }
  try {
    const { fire_id, property_address, policy_number, carrier, damage_estimate } = req.body || {};
    const r = await req.app.locals.pool.query(
      `INSERT INTO insurance_claims (fire_id, property_address, policy_number, carrier, damage_estimate, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'submitted',$6) RETURNING *`,
      [parseInt(fire_id, 10) || null, property_address || null, policy_number || null, carrier || null, damage_estimate || 0, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insurance/claims', auth, async (req, res) => {
  try {
    const r = await req.app.locals.pool.query(`SELECT * FROM insurance_claims ORDER BY created_at DESC LIMIT 100`);
    res.json({ claims: r.rows, configured: insuranceMissing().length === 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 4) Real-time dispatch (NEEDS-PRODUCT-DECISION → poll-based)
// -----------------------------------------------------------------------------
router.post('/dispatch/orders', auth, async (req, res) => {
  try {
    const { incident_id, unit_id, action, eta_minutes, details } = req.body || {};
    const r = await req.app.locals.pool.query(
      `INSERT INTO dispatch_orders (incident_id, unit_id, action, eta_minutes, status, details, created_by)
       VALUES ($1,$2,$3,$4,'dispatched',$5,$6) RETURNING *`,
      [parseInt(incident_id, 10) || null, unit_id || null, action || 'respond',
       parseInt(eta_minutes, 10) || null, details || null, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/dispatch/orders', auth, async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : null;
    const r = since
      ? await req.app.locals.pool.query(`SELECT * FROM dispatch_orders WHERE created_at > $1 ORDER BY created_at DESC LIMIT 200`, [since])
      : await req.app.locals.pool.query(`SELECT * FROM dispatch_orders ORDER BY created_at DESC LIMIT 200`);
    res.json({ orders: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 5) Radio / communication integration (NEEDS-CREDS)
// -----------------------------------------------------------------------------
function radioMissing() {
  const m = [];
  if (!process.env.RADIO_GATEWAY_URL) m.push('RADIO_GATEWAY_URL');
  if (!process.env.RADIO_GATEWAY_TOKEN) m.push('RADIO_GATEWAY_TOKEN');
  return m;
}

router.post('/radio/send', auth, async (req, res) => {
  const missing = radioMissing();
  if (missing.length) {
    return res.status(503).json({ error: 'Radio gateway not configured', missing: missing.join(',') });
  }
  try {
    const { channel, from_unit, to_unit, body, priority } = req.body || {};
    const r = await req.app.locals.pool.query(
      `INSERT INTO radio_messages (channel, from_unit, to_unit, body, priority, delivered, created_by)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6) RETURNING *`,
      [channel || 'TAC1', from_unit || null, to_unit || null, body || '', priority || 'normal', req.user.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/radio/messages', auth, async (req, res) => {
  try {
    const r = await req.app.locals.pool.query(`SELECT * FROM radio_messages ORDER BY created_at DESC LIMIT 200`);
    res.json({ messages: r.rows, configured: radioMissing().length === 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
