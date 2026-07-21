'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('migration defines durable incident, telemetry, forecast, replay, action, dispatch, exception, alert, and receipt state', () => {
  const sql = read('backend/migrations/001_governed_wildfire.sql');
  for (const table of [
    'wildfire_tenants', 'wildfire_memberships', 'wildfire_incidents', 'wildfire_sites', 'wildfire_assets',
    'wildfire_connector_checkpoints', 'wildfire_telemetry_events', 'wildfire_forecasts', 'wildfire_replay_evaluations',
    'wildfire_action_proposals', 'wildfire_action_approvals', 'wildfire_dispatch_jobs', 'wildfire_execution_events',
    'wildfire_exceptions', 'wildfire_public_alerts', 'wildfire_public_alert_approvals', 'wildfire_provider_outbox',
    'wildfire_integration_receipts', 'wildfire_audit_events',
  ]) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /evidence is append-only/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/);
});

test('runtime exposes only the governed tenant boundary with strong auth and verified production TLS', () => {
  const server = read('backend/src/index.js');
  const auth = read('backend/src/governance/auth.js');
  const db = read('backend/src/governance/db.js');
  assert.match(server, /\/api\/governance/);
  assert.doesNotMatch(server, /gap-ai|openrouter|riskAssessments|seed/);
  assert.match(auth, /issuer: env\.JWT_ISSUER/);
  assert.match(auth, /active_membership_required/);
  assert.doesNotMatch(auth, /dev-secret|JWT_SECRET\s*\|\|\s*['"]/);
  assert.match(db, /rejectUnauthorized: true/);
});

test('routes bind telemetry, forecasts, proposals, approvals, dispatch, execution, replay, and alerts to durable state', () => {
  const routes = read('backend/src/governance/routes.js');
  for (const marker of [
    'wildfire_telemetry_events', 'wildfire_connector_checkpoints', 'wildfire_forecasts', 'wildfire_replay_evaluations',
    'wildfire_action_proposals', 'wildfire_action_approvals', 'wildfire_dispatch_jobs', 'wildfire_execution_events',
    'wildfire_public_alert_approvals', 'wildfire_provider_outbox', 'authorizeDispatch', 'authorizePublicAlert',
  ]) assert.match(routes, new RegExp(marker));
  assert.match(routes, /FOR UPDATE/);
  assert.match(routes, /ON CONFLICT/);
});

test('launcher is nondestructive and separates install, migration, seed, and startup', () => {
  const launcher = read('start.sh');
  assert.doesNotMatch(launcher, /npm (install|ci)|createdb|CREATE DATABASE|brew services|kill -9|pkill|lsof -ti|seed\.js/);
  assert.match(launcher, /check\|migrate\|start/);
  assert.match(read('scripts/seed-development.sh'), /ALLOW_DEVELOPMENT_SEED/);
  assert.match(read('scripts/migrate.sh'), /ON_ERROR_STOP=1/);
});

test('CI and runbook require actual migration/build checks and external operational certification', () => {
  const workflow = read('.github/workflows/ci.yml');
  const operations = read('docs/OPERATIONS.md');
  const quarantine = read('docs/QUARANTINED_GENERATED_SURFACES.md');
  assert.match(workflow, /postgres:16/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /psql.*001_governed_wildfire\.sql/);
  assert.match(workflow, /npm run build/);
  assert.match(operations, /sequence gap pauses/i);
  assert.match(operations, /reconcile the provider\/CAD state/i);
  assert.match(operations, /External validation still required/);
  assert.match(quarantine, /mounts none/);
});
