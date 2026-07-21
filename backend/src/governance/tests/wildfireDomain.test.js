'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptConnectorEvent, authorizeDispatch, authorizePublicAlert, buildForecast, digest,
  ingestTelemetry, proposeAction, replayForecast, transitionAction,
} = require('../wildfireDomain');

const now = new Date('2026-07-18T16:00:00Z');
function telemetry(overrides = {}) {
  return ingestTelemetry({
    tenantId: 'tenant-a', incidentId: 'incident-1', kind: 'weather', sourceSystem: 'weather-authority',
    sourceEventId: 'weather-100', schemaVersion: 'wx-v2', observedAt: '2026-07-18T15:59:30Z',
    receivedAt: '2026-07-18T15:59:40Z', maximumAgeMs: 60_000, maximumDeliveryLagMs: 30_000,
    location: { lat: 40, lon: -120 }, quality: { station: 'verified' }, payload: { windSpeed: 12 }, ...overrides,
  }, now);
}

test('telemetry ingestion records authoritative timestamp, provenance, digest, and deduplication key', () => {
  const result = telemetry();
  assert.equal(result.ageMs, 30_000);
  assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.deduplicationKey, digest(['tenant-a', 'weather-authority', 'weather-100']));
});

test('stale, future, delayed, and untyped telemetry fail closed', () => {
  assert.throws(() => telemetry({ observedAt: '2026-07-18T15:00:00Z' }), (error) => error.code === 'stale_telemetry');
  assert.throws(() => telemetry({ observedAt: '2026-07-18T16:02:00Z', receivedAt: '2026-07-18T16:02:00Z' }), (error) => error.code === 'future_telemetry');
  assert.throws(() => telemetry({ observedAt: '2026-07-18T15:59:00Z', receivedAt: '2026-07-18T16:00:00Z' }), (error) => error.code === 'delayed_telemetry');
  assert.throws(() => telemetry({ kind: 'random_sensor' }), (error) => error.code === 'telemetry_kind_invalid');
});

test('connector checkpoints accept monotonic events, ignore duplicates, and block gaps', () => {
  const checkpoint = { tenantId: 'tenant-a', sourceSystem: 'cad', lastSequence: 8 };
  const accepted = acceptConnectorEvent(checkpoint, { tenantId: 'tenant-a', sourceSystem: 'cad', sequence: 9, sourceEventId: 'cad-9' });
  assert.equal(accepted.checkpoint.lastSequence, 9);
  assert.equal(acceptConnectorEvent(accepted.checkpoint, { tenantId: 'tenant-a', sourceSystem: 'cad', sequence: 9, sourceEventId: 'cad-9' }).duplicate, true);
  assert.throws(() => acceptConnectorEvent(accepted.checkpoint, { tenantId: 'tenant-a', sourceSystem: 'cad', sequence: 9, sourceEventId: 'different' }),
    (error) => error.code === 'connector_replay_conflict');
  assert.throws(() => acceptConnectorEvent(checkpoint, { tenantId: 'tenant-a', sourceSystem: 'cad', sequence: 10 }),
    (error) => error.code === 'connector_sequence_gap');
});

test('forecast is versioned, evidence-grounded, uncertainty-bearing, and never dispatches', () => {
  const evidence = ['fire_detection', 'weather', 'gis'].map((kind) => ({ tenantId: 'tenant-a', kind, evidenceDigest: digest(kind), observedAt: '2026-07-18T15:59:00Z' }));
  const forecast = buildForecast({
    tenantId: 'tenant-a', incidentId: 'incident-1', modelVersion: 'rothermel-calibrated-v4',
    configurationVersion: 'config-22', horizonsMinutes: [360, 60], evidence, generatedAt: now,
    perimeterEnvelopes: [{ horizon: 60, confidence: 0.8 }], uncertainty: { method: 'ensemble' }, limitations: ['no crown-fire transition'],
  });
  assert.deepEqual(forecast.horizonsMinutes, [60, 360]);
  assert.equal(forecast.automaticDispatchAllowed, false);
  assert.match(forecast.forecastDigest, /^[a-f0-9]{64}$/);
});

test('forecast refuses missing authoritative evidence and cross-tenant evidence', () => {
  assert.throws(() => buildForecast({ tenantId: 'tenant-a', modelVersion: 'm', configurationVersion: 'c', horizonsMinutes: [60], evidence: [] }),
    (error) => error.code === 'forecast_evidence_missing');
  const evidence = ['fire_detection', 'weather', 'gis'].map((kind) => ({ tenantId: kind === 'gis' ? 'tenant-b' : 'tenant-a', kind, evidenceDigest: digest(kind), observedAt: '2026-07-18T15:59:00Z' }));
  assert.throws(() => buildForecast({ tenantId: 'tenant-a', modelVersion: 'm', configurationVersion: 'c', horizonsMinutes: [60], evidence, generatedAt: now }),
    (error) => error.code === 'tenant_scope_violation');
  const stale = evidence.map((item) => ({ ...item, tenantId: 'tenant-a', observedAt: '2026-07-18T12:00:00Z' }));
  assert.throws(() => buildForecast({ tenantId: 'tenant-a', modelVersion: 'm', configurationVersion: 'c', horizonsMinutes: [60], evidence: stale, generatedAt: now }),
    (error) => error.code === 'forecast_evidence_stale');
});

test('historical replay measures error, latency, misses, constraints, and realized outcomes', () => {
  const result = replayForecast({
    predicted: [100, 160, 230], observed: [110, 150, 260], latencyP95Ms: 800,
    missedEvents: 0, constraintViolations: 0, realizedOutcome: { containedAcres: 270 },
    thresholds: { maximumMeanAbsoluteError: 20, maximumLatencyP95Ms: 1000, maximumMissedEvents: 0 },
  });
  assert.equal(result.passed, true);
  assert.equal(result.metrics.meanAbsoluteError, 50 / 3);
  assert.equal(replayForecast({
    predicted: [1], observed: [9], latencyP95Ms: 2000, missedEvents: 2, constraintViolations: 1,
    realizedOutcome: { contained: false }, thresholds: { maximumMeanAbsoluteError: 2, maximumLatencyP95Ms: 100, maximumMissedEvents: 0 },
  }).failures.length, 4);
});

function action(overrides = {}) {
  return proposeAction({
    tenantId: 'tenant-a', incidentId: 'incident-1', kind: 'resource_preposition', siteId: 'site-1', forecastId: 'forecast-1',
    assets: [{
      id: 'engine-7', tenantId: 'tenant-a', status: 'available', permissions: ['site-1'],
      maintenanceDue: false, crewDutyMinutes: 120, maximumDutyMinutes: 720,
    }],
    estimatedDurationMinutes: 180,
    safety: { routeOpen: true, escapeRouteVerified: true, windSpeed: 10, maximumWindSpeed: 25 },
    manualFallback: 'Return to staging and use command radio.', communicationPlan: 'CAD plus command radio check-in.',
    ...overrides,
  });
}

test('resource proposal validates live assets, permissions, maintenance, duty, routes, and safety limits', () => {
  const feasible = action();
  assert.equal(feasible.feasible, true);
  assert.equal(feasible.automaticDispatchAllowed, false);
  const unsafe = action({
    assets: [{ id: 'engine-7', tenantId: 'tenant-a', status: 'maintenance', permissions: [], maintenanceDue: true, crewDutyMinutes: 700, maximumDutyMinutes: 720 }],
    safety: { routeOpen: false, escapeRouteVerified: false, windSpeed: 50, maximumWindSpeed: 20 },
  });
  assert.equal(unsafe.feasible, false);
  assert.ok(unsafe.violations.length >= 6);
});

test('dispatch requires feasible current evidence, manual fallback, permission, and independent command/safety approvals', () => {
  const input = {
    tenantId: 'tenant-a', proposalId: 'proposal-1', proposalDigest: 'digest-1',
    proposalStatus: 'under_review', feasible: true, forecastAgeMs: 30_000, maximumForecastAgeMs: 60_000,
    manualFallback: 'radio', actorPermissions: ['dispatch'], approvals: [
      { reviewerId: 'commander', role: 'incident_commander', decision: 'approved' },
      { reviewerId: 'safety', role: 'safety_officer', decision: 'approved' },
    ],
  };
  assert.equal(authorizeDispatch(input).authorized, true);
  assert.throws(() => authorizeDispatch({ ...input, forecastAgeMs: 90_000, approvals: [input.approvals[0]] }),
    (error) => error.code === 'dispatch_blocked' && error.details.blockers.includes('forecast_stale'));
});

test('public alert requires official evidence, fresh sources, verified translations, permission, and dual approval', () => {
  const input = {
    officialZoneVersion: 'zone-v9', capTemplateVersion: 'cap-1.2', sourceAgeMs: 10_000,
    translationsVerified: true, actorPermissions: ['send_alert'], payload: { headline: 'Evacuate Zone A' },
    approvals: [{ reviewerId: 'c', role: 'incident_commander' }, { reviewerId: 'p', role: 'public_information_officer' }],
  };
  assert.equal(authorizePublicAlert(input).authorized, true);
  assert.throws(() => authorizePublicAlert({ ...input, translationsVerified: false, actorPermissions: [] }),
    (error) => error.code === 'alert_blocked' && error.details.blockers.includes('translations_unverified'));
});

test('execution lifecycle requires dispatch receipts, typed failures, and realized completion feedback', () => {
  const dispatched = transitionAction({ status: 'queued' }, 'dispatched', { providerReceipt: 'cad-44', sentAt: '2026-07-18T16:00:00Z' });
  assert.equal(dispatched.status, 'dispatched');
  assert.throws(() => transitionAction({ status: 'queued' }, 'dispatched', {}), (error) => error.code === 'dispatch_receipt_required');
  assert.throws(() => transitionAction({ status: 'executing' }, 'completed', {}), (error) => error.code === 'execution_feedback_required');
});
