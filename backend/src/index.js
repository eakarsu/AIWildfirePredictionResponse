'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createPool } = require('./governance/db');
const { assertAuthConfiguration, authenticate } = require('./governance/auth');
const { createGovernanceRouter } = require('./governance/routes');
const { createAuthRouter } = require('./governance/authRoutes');
const { WildfireError } = require('./governance/wildfireDomain');

function assertConfiguration(env = process.env) {
  assertAuthConfiguration(env);
  if (!env.CLIENT_URL) throw new Error('CLIENT_URL is required');
}

function createApp({ pool, env = process.env }) {
  assertConfiguration(env);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true, methods: ['GET', 'POST'] }));
  app.use(express.json({ limit: '2mb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: Number(env.RATE_LIMIT_PER_MINUTE || 180), standardHeaders: true }));
  app.get('/healthz', async (_req, res, next) => {
    try { await pool.query('SELECT 1'); return res.json({ status: 'ok' }); } catch (error) { return next(error); }
  });
  app.get('/api/health', async (_req, res, next) => {
    try { await pool.query('SELECT 1'); return res.json({ status: 'ok' }); } catch (error) { return next(error); }
  });
  app.use('/api/auth', createAuthRouter(pool, env));
  app.use('/api/governance', authenticate(pool, env), createGovernanceRouter(pool));
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof WildfireError) {
      const status = error.code.endsWith('_not_found') ? 404 : error.code.includes('blocked') ? 409 : 422;
      return res.status(status).json({ error: error.code, message: error.message, details: error.details });
    }
    console.error({ name: error.name, message: error.message });
    return res.status(500).json({ error: 'internal_error' });
  });
  return app;
}

async function main() {
  assertConfiguration(process.env);
  const pool = createPool(process.env);
  const port = Number(process.env.BACKEND_PORT);
  if (!Number.isInteger(port) || port < 1) throw new Error('BACKEND_PORT is required');
  const server = createApp({ pool, env: process.env }).listen(port, process.env.BIND_HOST || '127.0.0.1');
  const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { assertConfiguration, createApp };
