'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { createPool } = require('../src/governance/db');
const pool = createPool(process.env);

async function main() {
  if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') throw new Error('Explicit bootstrap acknowledgement is required');
  const email = (process.env.PROVISION_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || '';
  const tenantName = (process.env.BOOTSTRAP_TENANT_NAME || '').trim();
  if (!email || !tenantName || password.length < 12) throw new Error('Admin email, tenant name, and a 12+ character password are required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM wildfire_users WHERE lower(email)=$1 FOR UPDATE', [email]);
    if (existing.rows.length) { await client.query('ROLLBACK'); return console.log('Initial admin already exists; credentials were not changed.'); }
    const tenant = await client.query('INSERT INTO wildfire_tenants(name) VALUES($1) RETURNING id', [tenantName]);
    const user = await client.query('INSERT INTO wildfire_users(email,password_hash) VALUES($1,$2) RETURNING id', [email, await bcrypt.hash(password, 12)]);
    await client.query(`INSERT INTO wildfire_memberships(tenant_id,user_id,role,permissions) VALUES($1,$2,'administrator',$3)`, [tenant.rows[0].id, user.rows[0].id, JSON.stringify(['*'])]);
    await client.query('COMMIT');
    console.log('Initial wildfire administrator created.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
