'use strict';
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { createPool } = require('../src/governance/db');

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  const pool = createPool(process.env);
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.resolve(__dirname, '../migrations/001_governed_wildfire.sql'), 'utf8'));
    await client.query(`CREATE TABLE IF NOT EXISTS wildfire_ai_results (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
      user_id uuid NOT NULL REFERENCES wildfire_users(id),
      input jsonb NOT NULL, result jsonb NOT NULL, model text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    const email = (process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
    if (!email || password.length < 12) throw new Error('Runtime administrator credentials are required');
    let tenant = await client.query('SELECT id FROM wildfire_tenants WHERE name=$1 ORDER BY created_at LIMIT 1', ['Runtime Wildfire Tenant']);
    if (!tenant.rowCount) tenant = await client.query('INSERT INTO wildfire_tenants(name) VALUES($1) RETURNING id', ['Runtime Wildfire Tenant']);
    const tenantId = tenant.rows[0].id;
    const user = await client.query(
      `INSERT INTO wildfire_users(email,password_hash,status) VALUES($1,$2,'active')
       ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active' RETURNING id`,
      [email, await bcrypt.hash(password, 12)],
    );
    await client.query(
      `INSERT INTO wildfire_memberships(tenant_id,user_id,role,permissions,status)
       VALUES($1,$2,'administrator',$3::jsonb,'active')
       ON CONFLICT (tenant_id,user_id) DO UPDATE SET role='administrator',permissions=EXCLUDED.permissions,status='active'`,
      [tenantId, user.rows[0].id, JSON.stringify(['*'])],
    );
  } finally { client.release(); await pool.end(); }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
