'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('./auth');

function createAuthRouter(pool, env) {
  const router = require('express').Router();
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
      const result = await pool.query(
        `SELECT u.id,u.email,u.password_hash,m.tenant_id,m.role
         FROM wildfire_users u JOIN wildfire_memberships m ON m.user_id=u.id AND m.status='active'
         JOIN wildfire_tenants t ON t.id=m.tenant_id AND t.status='active'
         WHERE lower(u.email)=lower($1) AND u.status='active' ORDER BY m.created_at LIMIT 2`,
        [email],
      );
      if (result.rows.length !== 1 || !await bcrypt.compare(password, result.rows[0].password_hash)) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }
      const account = result.rows[0];
      const token = jwt.sign({ tenant_id: account.tenant_id, role: account.role }, env.JWT_SECRET, {
        subject: account.id, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithm: 'HS256', expiresIn: '1h',
      });
      return res.json({ token, user: { id: account.id, email: account.email, role: account.role, tenantId: account.tenant_id } });
    } catch (error) {
      console.error('Login error:', error.message);
      return res.status(503).json({ error: 'authentication_unavailable' });
    }
  });
  router.get('/me', authenticate(pool, env), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT u.id,u.email,m.role,m.tenant_id AS "tenantId" FROM wildfire_users u
         JOIN wildfire_memberships m ON m.user_id=u.id AND m.tenant_id=$2 AND m.status='active'
         WHERE u.id=$1 AND u.status='active'`,
        [req.auth.userId, req.auth.tenantId],
      );
      if (!result.rows.length) return res.status(404).json({ error: 'user_not_found' });
      return res.json(result.rows[0]);
    } catch (_error) { return res.status(503).json({ error: 'authentication_unavailable' }); }
  });
  return router;
}
module.exports = { createAuthRouter };
