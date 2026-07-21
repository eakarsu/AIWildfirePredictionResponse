'use strict';

const crypto = require('node:crypto');

const ACTION_TRANSITIONS = Object.freeze({
  proposed: ['under_review', 'cancelled'],
  under_review: ['approved', 'rejected', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['dispatched', 'failed', 'cancelled'],
  dispatched: ['acknowledged', 'failed'],
  acknowledged: ['executing', 'failed'],
  executing: ['completed', 'exception'],
  exception: ['executing', 'cancelled'],
  failed: ['queued', 'cancelled'],
  completed: [], rejected: [], cancelled: [],
});

class WildfireError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WildfireError';
    this.code = code;
    this.details = details;
  }
}

function requireValue(value, code, message) {
  if (value === undefined || value === null || value === '') throw new WildfireError(code, message);
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertTenant(expected, actual) {
  if (!expected || expected !== actual) throw new WildfireError('tenant_scope_violation', 'Resource is outside the tenant');
}

function ingestTelemetry(input, now = new Date()) {
  requireValue(input.tenantId, 'tenant_required', 'tenantId is required');
  requireValue(input.incidentId, 'incident_required', 'incidentId is required');
  requireValue(input.sourceSystem, 'source_required', 'sourceSystem is required');
  requireValue(input.sourceEventId, 'event_id_required', 'sourceEventId is required');
  requireValue(input.schemaVersion, 'schema_required', 'schemaVersion is required');
  if (!['fire_detection', 'weather', 'air_quality', 'resource', 'crew', 'equipment', 'road', 'utility', 'gis', 'maintenance'].includes(input.kind)) {
    throw new WildfireError('telemetry_kind_invalid', 'Telemetry kind is unsupported');
  }
  const observedAt = new Date(input.observedAt);
  const receivedAt = new Date(input.receivedAt || now);
  if (Number.isNaN(observedAt.valueOf()) || Number.isNaN(receivedAt.valueOf())) {
    throw new WildfireError('timestamp_invalid', 'Observed and received timestamps must be valid');
  }
  const ageMs = now - observedAt;
  if (ageMs < -60_000) throw new WildfireError('future_telemetry', 'Telemetry is too far in the future');
  const maximumAgeMs = Number(input.maximumAgeMs || 300_000);
  if (ageMs > maximumAgeMs) throw new WildfireError('stale_telemetry', 'Telemetry exceeds its declared freshness limit', { ageMs, maximumAgeMs });
  if (receivedAt < observedAt || receivedAt - observedAt > Number(input.maximumDeliveryLagMs || 120_000)) {
    throw new WildfireError('delayed_telemetry', 'Telemetry delivery lag exceeds its limit');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new WildfireError('payload_invalid', 'Telemetry payload must be an object');
  }
  const normalized = {
    tenantId: input.tenantId, incidentId: input.incidentId, kind: input.kind,
    sourceSystem: input.sourceSystem, sourceEventId: input.sourceEventId,
    schemaVersion: input.schemaVersion, observedAt: observedAt.toISOString(), receivedAt: receivedAt.toISOString(),
    location: input.location || null, quality: input.quality || {}, payload: input.payload,
  };
  return Object.freeze({
    ...normalized,
    deduplicationKey: digest([input.tenantId, input.sourceSystem, input.sourceEventId]),
    evidenceDigest: digest(normalized),
    ageMs,
  });
}

function buildForecast(input) {
  const evidence = input.evidence || [];
  const requiredKinds = ['fire_detection', 'weather', 'gis'];
  const present = new Set(evidence.map((item) => item.kind));
  const missing = requiredKinds.filter((kind) => !present.has(kind));
  if (missing.length) throw new WildfireError('forecast_evidence_missing', 'Required forecast evidence is missing', { missing });
  const generatedAt = new Date(input.generatedAt || Date.now());
  const maximumEvidenceAgeMs = Number(input.maximumEvidenceAgeMs || 300_000);
  for (const item of evidence) {
    assertTenant(input.tenantId, item.tenantId);
    const observedAt = new Date(item.observedAt);
    if (Number.isNaN(observedAt.valueOf())) throw new WildfireError('forecast_evidence_timestamp_invalid', 'Forecast evidence requires an observation timestamp');
    if (generatedAt - observedAt > maximumEvidenceAgeMs || generatedAt - observedAt < -60_000) {
      throw new WildfireError('forecast_evidence_stale', 'Forecast evidence is outside the freshness window', { kind: item.kind });
    }
  }
  if (!input.modelVersion || !input.configurationVersion) {
    throw new WildfireError('forecast_version_missing', 'Pinned model and configuration versions are required');
  }
  if (!Array.isArray(input.horizonsMinutes) || !input.horizonsMinutes.length || input.horizonsMinutes.some((n) => n <= 0 || n > 2880)) {
    throw new WildfireError('forecast_horizon_invalid', 'Forecast horizons must be within 48 hours');
  }
  const forecast = {
    id: input.id || crypto.randomUUID(), tenantId: input.tenantId, incidentId: input.incidentId,
    modelVersion: input.modelVersion, configurationVersion: input.configurationVersion,
    evidenceDigests: evidence.map((item) => item.evidenceDigest).sort(),
    horizonsMinutes: [...input.horizonsMinutes].sort((a, b) => a - b),
    perimeterEnvelopes: input.perimeterEnvelopes || [], uncertainty: input.uncertainty || {},
    assumptions: input.assumptions || [], limitations: input.limitations || [], status: 'advisory',
  };
  return Object.freeze({ ...forecast, forecastDigest: digest(forecast), automaticDispatchAllowed: false });
}

function replayForecast(input) {
  const predicted = input.predicted || [];
  const observed = input.observed || [];
  if (!predicted.length || predicted.length !== observed.length) {
    throw new WildfireError('replay_samples_invalid', 'Aligned predicted and observed samples are required');
  }
  const errors = predicted.map((value, index) => Math.abs(Number(value) - Number(observed[index])));
  if (errors.some((value) => !Number.isFinite(value))) throw new WildfireError('replay_value_invalid', 'Replay values must be finite');
  const meanAbsoluteError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const missedEvents = Number(input.missedEvents || 0);
  const latencyP95Ms = Number(input.latencyP95Ms || 0);
  const constraintViolations = Number(input.constraintViolations || 0);
  const realizedOutcome = requireValue(input.realizedOutcome, 'realized_outcome_required', 'Realized operational outcome is required');
  const thresholds = input.thresholds || {};
  const failures = [];
  if (meanAbsoluteError > Number(thresholds.maximumMeanAbsoluteError ?? Infinity)) failures.push('forecast_error');
  if (latencyP95Ms > Number(thresholds.maximumLatencyP95Ms ?? Infinity)) failures.push('latency');
  if (missedEvents > Number(thresholds.maximumMissedEvents ?? 0)) failures.push('missed_events');
  if (constraintViolations > 0) failures.push('constraint_violations');
  return Object.freeze({
    passed: failures.length === 0, failures,
    metrics: { meanAbsoluteError, maximumAbsoluteError: Math.max(...errors), latencyP95Ms, missedEvents, constraintViolations },
    realizedOutcome,
  });
}

function proposeAction(input) {
  if (!['resource_preposition', 'crew_deployment', 'equipment_move', 'evacuation_support', 'utility_coordination', 'public_alert'].includes(input.kind)) {
    throw new WildfireError('action_kind_invalid', 'Action kind is unsupported');
  }
  if (!Array.isArray(input.assets) || !input.assets.length) throw new WildfireError('assets_required', 'At least one live asset is required');
  const violations = [];
  for (const asset of input.assets) {
    assertTenant(input.tenantId, asset.tenantId);
    if (asset.status !== 'available') violations.push({ assetId: asset.id, reason: 'unavailable' });
    if (!(asset.permissions || []).includes(input.siteId)) violations.push({ assetId: asset.id, reason: 'site_permission' });
    if (asset.maintenanceDue === true) violations.push({ assetId: asset.id, reason: 'maintenance_due' });
    if (Number(asset.crewDutyMinutes || 0) + Number(input.estimatedDurationMinutes || 0) > Number(asset.maximumDutyMinutes || 0)) {
      violations.push({ assetId: asset.id, reason: 'crew_duty_limit' });
    }
  }
  const safety = input.safety || {};
  if (safety.routeOpen !== true) violations.push({ reason: 'route_closed' });
  if (safety.escapeRouteVerified !== true) violations.push({ reason: 'escape_route_unverified' });
  if (Number(safety.windSpeed || 0) > Number(safety.maximumWindSpeed || 0)) violations.push({ reason: 'wind_limit' });
  if (!input.manualFallback || !input.communicationPlan) violations.push({ reason: 'fallback_missing' });
  return Object.freeze({
    id: input.id || crypto.randomUUID(), tenantId: input.tenantId, incidentId: input.incidentId,
    kind: input.kind, siteId: input.siteId, assetIds: input.assets.map((asset) => asset.id).sort(),
    forecastId: input.forecastId, constraints: input.constraints || {}, objective: input.objective || {},
    violations, feasible: violations.length === 0, status: 'proposed',
    manualFallback: input.manualFallback, communicationPlan: input.communicationPlan,
    automaticDispatchAllowed: false,
  });
}

function authorizeDispatch(input) {
  const blockers = [];
  if (input.proposalStatus !== 'under_review') blockers.push('proposal_not_under_review');
  if (input.feasible !== true) blockers.push('constraints_not_satisfied');
  if (Number(input.forecastAgeMs) > Number(input.maximumForecastAgeMs || 300_000)) blockers.push('forecast_stale');
  if (!input.manualFallback) blockers.push('manual_fallback_missing');
  const approvals = input.approvals || [];
  const roles = new Set(approvals.filter((approval) => approval.decision === 'approved').map((approval) => approval.role));
  if (!roles.has('incident_commander')) blockers.push('incident_commander_approval_required');
  if (!roles.has('safety_officer')) blockers.push('safety_officer_approval_required');
  if (new Set(approvals.map((approval) => approval.reviewerId)).size < 2) blockers.push('independent_review_required');
  if (!input.actorPermissions?.includes('dispatch')) blockers.push('dispatch_permission_required');
  if (blockers.length) throw new WildfireError('dispatch_blocked', 'Dispatch requirements are not satisfied', { blockers });
  return Object.freeze({
    authorized: true, dispatchId: input.dispatchId || crypto.randomUUID(), proposalId: input.proposalId,
    idempotencyKey: digest([input.tenantId, input.proposalId, input.proposalDigest]),
  });
}

function authorizePublicAlert(input) {
  const blockers = [];
  if (!input.officialZoneVersion) blockers.push('official_zone_required');
  if (!input.capTemplateVersion) blockers.push('cap_template_required');
  if (input.sourceAgeMs > Number(input.maximumSourceAgeMs || 120_000)) blockers.push('source_stale');
  if (!input.translationsVerified) blockers.push('translations_unverified');
  const roles = new Set((input.approvals || []).map((approval) => approval.role));
  if (!roles.has('incident_commander') || !roles.has('public_information_officer')) blockers.push('alert_dual_approval_required');
  if (!input.actorPermissions?.includes('send_alert')) blockers.push('alert_permission_required');
  if (blockers.length) throw new WildfireError('alert_blocked', 'Public alert requirements are not satisfied', { blockers });
  return Object.freeze({ authorized: true, alertDigest: digest(input.payload), automaticSendAllowed: false });
}

function transitionAction(action, nextStatus, evidence = {}) {
  if (!(ACTION_TRANSITIONS[action.status] || []).includes(nextStatus)) {
    throw new WildfireError('action_transition_invalid', `${action.status} cannot transition to ${nextStatus}`);
  }
  if (nextStatus === 'dispatched' && (!evidence.providerReceipt || !evidence.sentAt)) {
    throw new WildfireError('dispatch_receipt_required', 'Dispatch requires provider receipt and sent timestamp');
  }
  if (nextStatus === 'failed' && (!evidence.errorCode || evidence.retryable === undefined)) {
    throw new WildfireError('failure_evidence_required', 'Failure requires a typed error and retryability');
  }
  if (nextStatus === 'completed' && (!evidence.completedAt || !evidence.realizedOutcome)) {
    throw new WildfireError('execution_feedback_required', 'Completion requires timestamp and realized outcome');
  }
  return Object.freeze({ ...action, status: nextStatus, evidence: Object.freeze({ ...evidence }) });
}

function acceptConnectorEvent(checkpoint, event) {
  if (checkpoint.tenantId !== event.tenantId || checkpoint.sourceSystem !== event.sourceSystem) {
    throw new WildfireError('connector_scope_violation', 'Connector checkpoint scope does not match event');
  }
  if (event.sequence === checkpoint.lastSequence && event.sourceEventId === checkpoint.lastEventId) {
    return Object.freeze({ accepted: false, duplicate: true, checkpoint });
  }
  if (event.sequence <= checkpoint.lastSequence) {
    throw new WildfireError('connector_replay_conflict', 'Connector sequence was reused or reordered');
  }
  if (event.sequence !== checkpoint.lastSequence + 1) {
    throw new WildfireError('connector_sequence_gap', 'Connector sequence gap requires reconciliation');
  }
  return Object.freeze({ accepted: true, duplicate: false, checkpoint: { ...checkpoint, lastSequence: event.sequence, lastEventId: event.sourceEventId } });
}

module.exports = {
  ACTION_TRANSITIONS, WildfireError, acceptConnectorEvent, assertTenant, authorizeDispatch,
  authorizePublicAlert, buildForecast, digest, ingestTelemetry, proposeAction, replayForecast, transitionAction,
};
