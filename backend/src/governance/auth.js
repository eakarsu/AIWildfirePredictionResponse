'use strict';

const jwt = require('jsonwebtoken');

function assertAuthConfiguration(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  if (!env.JWT_ISSUER || !env.JWT_AUDIENCE) throw new Error('JWT issuer and audience are required');
}

function authenticate(pool, env = process.env) {
  assertAuthConfiguration(env);
  return async (req, res, next) => {
    try {
      const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
      if (!match) return res.status(401).json({ error: 'bearer_token_required' });
      const claims = jwt.verify(match[1], env.JWT_SECRET, {
        issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithms: ['HS256'],
      });
      if (!claims.sub || !claims.tenant_id) return res.status(403).json({ error: 'tenant_claim_required' });
      const membership = await pool.query(
        `SELECT role, permissions FROM wildfire_memberships
         WHERE tenant_id=$1 AND user_id=$2 AND status='active'`,
        [claims.tenant_id, claims.sub],
      );
      if (membership.rowCount !== 1) return res.status(403).json({ error: 'active_membership_required' });
      req.auth = {
        userId: claims.sub, tenantId: claims.tenant_id, role: membership.rows[0].role,
        permissions: membership.rows[0].permissions || [],
      };
      return next();
    } catch (_error) { return res.status(401).json({ error: 'invalid_token' }); }
  };
}

function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.auth?.role) ? next() : res.status(403).json({ error: 'insufficient_role' });
}

module.exports = { assertAuthConfiguration, authenticate, requireRoles };
