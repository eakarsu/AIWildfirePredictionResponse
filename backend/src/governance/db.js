'use strict';

const { Pool } = require('pg');

function createPool(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (env.NODE_ENV === 'production' && env.DATABASE_SSL !== 'require') throw new Error('Production database TLS is required');
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === 'require' ? { rejectUnauthorized: true } : false,
    max: Number(env.DATABASE_POOL_MAX || 12),
    statement_timeout: Number(env.DATABASE_STATEMENT_TIMEOUT_MS || 10_000),
    idle_in_transaction_session_timeout: Number(env.DATABASE_IDLE_TX_TIMEOUT_MS || 10_000),
  });
}

module.exports = { createPool };
