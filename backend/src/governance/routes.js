'use strict';

const express = require('express');
const {
  WildfireError, acceptConnectorEvent, authorizeDispatch, authorizePublicAlert, buildForecast,
  digest, ingestTelemetry, proposeAction, replayForecast, transitionAction,
} = require('./wildfireDomain');
const { requireRoles } = require('./auth');
const { requestAdvice } = require('../services/openrouterRuntime');

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function audit(client, auth, action, entityType, entityId, evidence = {}) {
  return client.query(
    `INSERT INTO wildfire_audit_events (tenant_id,actor_id,action,entity_type,entity_id,evidence)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [auth.tenantId, auth.userId, action, entityType, entityId, JSON.stringify(evidence)],
  );
}

function createGovernanceRouter(pool) {
  const router = express.Router();

  router.post('/ai/incident-advice', requireRoles('administrator', 'incident_commander', 'analyst'), async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object' || !Object.keys(req.body).length) {
        return res.status(400).json({ error: 'incident_context_required' });
      }
      const advice = await requestAdvice(req.body);
      const saved = await pool.query(
        `INSERT INTO wildfire_ai_results(tenant_id,user_id,input,result,model)
         VALUES($1,$2,$3::jsonb,$4::jsonb,$5) RETURNING id,created_at`,
        [req.auth.tenantId, req.auth.userId, JSON.stringify(req.body), JSON.stringify({ text: advice.result }), advice.model],
      );
      return res.json({ success: true, result: advice.result, model: advice.model, persisted: saved.rows[0] });
    } catch (error) { return next(error); }
  });

  router.post('/incidents', requireRoles('administrator', 'incident_commander'), async (req, res, next) => {
    try {
      const created = await transaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO wildfire_incidents
             (tenant_id,incident_number,name,status,command_version,official_boundary,created_by)
           VALUES ($1,$2,$3,'monitoring',$4,$5::jsonb,$6) RETURNING *`,
          [req.auth.tenantId, req.body.incidentNumber, req.body.name, req.body.commandVersion,
            JSON.stringify(req.body.officialBoundary), req.auth.userId],
        );
        await audit(client, req.auth, 'incident.created', 'incident', result.rows[0].id);
        return result.rows[0];
      });
      return res.status(201).json(created);
    } catch (error) { return next(error); }
  });

  router.post('/incidents/:incidentId/telemetry', requireRoles('administrator', 'incident_commander', 'operations', 'analyst'), async (req, res, next) => {
    try {
      const event = ingestTelemetry({ ...req.body, tenantId: req.auth.tenantId, incidentId: req.params.incidentId });
      const result = await transaction(pool, async (client) => {
        const incident = await client.query('SELECT id FROM wildfire_incidents WHERE id=$1 AND tenant_id=$2', [req.params.incidentId, req.auth.tenantId]);
        if (!incident.rowCount) throw new WildfireError('incident_not_found', 'Incident was not found');
        if (req.body.sourceSequence !== undefined) {
          const checkpointResult = await client.query(
            `SELECT * FROM wildfire_connector_checkpoints WHERE tenant_id=$1 AND source_system=$2 FOR UPDATE`,
            [req.auth.tenantId, event.sourceSystem],
          );
          const checkpoint = checkpointResult.rows[0]
            ? { tenantId: req.auth.tenantId, sourceSystem: event.sourceSystem, lastSequence: Number(checkpointResult.rows[0].last_sequence), lastEventId: checkpointResult.rows[0].last_event_id }
            : { tenantId: req.auth.tenantId, sourceSystem: event.sourceSystem, lastSequence: 0, lastEventId: null };
          const accepted = acceptConnectorEvent(checkpoint, { ...event, tenantId: req.auth.tenantId, sourceSystem: event.sourceSystem, sequence: Number(req.body.sourceSequence) });
          if (!accepted.accepted) return { duplicate: true, sourceEventId: event.sourceEventId };
          await client.query(
            `INSERT INTO wildfire_connector_checkpoints (tenant_id,source_system,last_sequence,last_event_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,source_system) DO UPDATE
             SET last_sequence=EXCLUDED.last_sequence,last_event_id=EXCLUDED.last_event_id,updated_at=now()`,
            [req.auth.tenantId, event.sourceSystem, accepted.checkpoint.lastSequence, accepted.checkpoint.lastEventId],
          );
        }
        const inserted = await client.query(
          `INSERT INTO wildfire_telemetry_events
             (tenant_id,incident_id,kind,source_system,source_event_id,source_sequence,schema_version,
              observed_at,received_at,location,quality,payload,evidence_digest,deduplication_key,ingest_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,'accepted')
           ON CONFLICT (tenant_id,source_system,source_event_id) DO NOTHING RETURNING *`,
          [event.tenantId, event.incidentId, event.kind, event.sourceSystem, event.sourceEventId,
            req.body.sourceSequence || null, event.schemaVersion, event.observedAt, event.receivedAt,
            JSON.stringify(event.location), JSON.stringify(event.quality), JSON.stringify(event.payload),
            event.evidenceDigest, event.deduplicationKey],
        );
        if (!inserted.rowCount) return { duplicate: true, sourceEventId: event.sourceEventId };
        await audit(client, req.auth, 'telemetry.accepted', 'incident', req.params.incidentId, { digest: event.evidenceDigest });
        return inserted.rows[0];
      });
      return res.status(result.duplicate ? 200 : 202).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/incidents/:incidentId/forecasts', requireRoles('incident_commander', 'operations', 'analyst'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const evidenceResult = await client.query(
          `SELECT tenant_id,kind,evidence_digest,observed_at FROM wildfire_telemetry_events
           WHERE tenant_id=$1 AND incident_id=$2 AND ingest_status='accepted'
           ORDER BY observed_at DESC LIMIT 200`,
          [req.auth.tenantId, req.params.incidentId],
        );
        const evidence = evidenceResult.rows.map((row) => ({
          tenantId: row.tenant_id, kind: row.kind, evidenceDigest: row.evidence_digest, observedAt: row.observed_at,
        }));
        const forecast = buildForecast({ ...req.body, tenantId: req.auth.tenantId, incidentId: req.params.incidentId, evidence });
        const inserted = await client.query(
          `INSERT INTO wildfire_forecasts
             (id,tenant_id,incident_id,model_version,configuration_version,evidence_digests,horizons_minutes,
              perimeter_envelopes,uncertainty,assumptions,limitations,forecast_digest,status,created_by)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,'advisory',$13) RETURNING *`,
          [forecast.id, forecast.tenantId, forecast.incidentId, forecast.modelVersion, forecast.configurationVersion,
            JSON.stringify(forecast.evidenceDigests), JSON.stringify(forecast.horizonsMinutes),
            JSON.stringify(forecast.perimeterEnvelopes), JSON.stringify(forecast.uncertainty),
            JSON.stringify(forecast.assumptions), JSON.stringify(forecast.limitations), forecast.forecastDigest, req.auth.userId],
        );
        await audit(client, req.auth, 'forecast.created', 'forecast', forecast.id, { digest: forecast.forecastDigest, advisory: true });
        return inserted.rows[0];
      });
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/incidents/:incidentId/replay-evaluations', requireRoles('administrator', 'incident_commander', 'analyst'), async (req, res, next) => {
    try {
      const evaluation = replayForecast(req.body);
      const inserted = await pool.query(
        `INSERT INTO wildfire_replay_evaluations
           (tenant_id,incident_id,forecast_id,scenario_version,passed,failures,metrics,realized_outcome,evaluator_version,created_by)
         SELECT $1,id,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10 FROM wildfire_incidents
         WHERE id=$2 AND tenant_id=$1 RETURNING *`,
        [req.auth.tenantId, req.params.incidentId, req.body.forecastId || null, req.body.scenarioVersion,
          evaluation.passed, JSON.stringify(evaluation.failures), JSON.stringify(evaluation.metrics),
          JSON.stringify(evaluation.realizedOutcome), req.body.evaluatorVersion, req.auth.userId],
      );
      if (!inserted.rowCount) throw new WildfireError('incident_not_found', 'Incident was not found');
      return res.status(201).json(inserted.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/incidents/:incidentId/action-proposals', requireRoles('incident_commander', 'operations', 'dispatcher'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const assetsResult = await client.query('SELECT * FROM wildfire_assets WHERE tenant_id=$1 AND id=ANY($2::uuid[]) FOR UPDATE', [req.auth.tenantId, req.body.assetIds]);
        if (assetsResult.rowCount !== (req.body.assetIds || []).length) throw new WildfireError('asset_not_found', 'One or more assets were not found');
        const site = await client.query('SELECT * FROM wildfire_sites WHERE tenant_id=$1 AND id=$2 AND incident_id=$3', [req.auth.tenantId, req.body.siteId, req.params.incidentId]);
        if (!site.rowCount) throw new WildfireError('site_not_found', 'Site was not found');
        const assets = assetsResult.rows.map((row) => ({
          id: row.id, tenantId: row.tenant_id, status: row.status,
          siteId: req.body.siteId, permissions: row.permitted_sites || [],
          maintenanceDue: row.maintenance_due_at && new Date(row.maintenance_due_at) <= new Date(),
          crewDutyMinutes: row.crew_duty_minutes, maximumDutyMinutes: row.maximum_duty_minutes,
        }));
        const proposal = proposeAction({ ...req.body, tenantId: req.auth.tenantId, incidentId: req.params.incidentId, assets });
        const proposalDigest = digest(proposal);
        const inserted = await client.query(
          `INSERT INTO wildfire_action_proposals
             (id,tenant_id,incident_id,kind,site_id,forecast_id,asset_ids,constraints,objective,violations,
              feasible,manual_fallback,communication_plan,proposal_digest,status,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,'proposed',$15) RETURNING *`,
          [proposal.id, proposal.tenantId, proposal.incidentId, proposal.kind, proposal.siteId,
            proposal.forecastId, JSON.stringify(proposal.assetIds), JSON.stringify(proposal.constraints),
            JSON.stringify(proposal.objective), JSON.stringify(proposal.violations), proposal.feasible,
            proposal.manualFallback, proposal.communicationPlan, proposalDigest, req.auth.userId],
        );
        await audit(client, req.auth, 'action.proposed', 'action_proposal', proposal.id, { proposalDigest, feasible: proposal.feasible });
        return inserted.rows[0];
      });
      return res.status(201).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/action-proposals/:proposalId/review', requireRoles('incident_commander', 'safety_officer'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const found = await client.query('SELECT * FROM wildfire_action_proposals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.proposalId, req.auth.tenantId]);
        if (!found.rowCount) throw new WildfireError('proposal_not_found', 'Proposal was not found');
        const state = transitionAction({ status: found.rows[0].status }, 'under_review');
        const updated = await client.query('UPDATE wildfire_action_proposals SET status=$2,updated_at=now() WHERE id=$1 RETURNING *', [req.params.proposalId, state.status]);
        await audit(client, req.auth, 'action.review_started', 'action_proposal', req.params.proposalId);
        return updated.rows[0];
      });
      return res.json(result);
    } catch (error) { return next(error); }
  });

  router.post('/action-proposals/:proposalId/approvals', requireRoles('incident_commander', 'safety_officer'), async (req, res, next) => {
    try {
      const result = await pool.query(
        `INSERT INTO wildfire_action_approvals
           (tenant_id,proposal_id,reviewer_id,role,decision,rationale,proposal_digest)
         SELECT tenant_id,id,$3,$4,$5,$6,proposal_digest FROM wildfire_action_proposals
         WHERE id=$1 AND tenant_id=$2 AND status='under_review'
         ON CONFLICT (proposal_id,reviewer_id,role) DO UPDATE
           SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,decided_at=now()
         RETURNING *`,
        [req.params.proposalId, req.auth.tenantId, req.auth.userId, req.auth.role, req.body.decision, req.body.rationale],
      );
      if (!result.rowCount) throw new WildfireError('proposal_not_reviewable', 'Proposal is not available for review');
      return res.status(201).json(result.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/action-proposals/:proposalId/dispatch', requireRoles('incident_commander', 'dispatcher'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const proposalResult = await client.query(
          `SELECT p.*,f.created_at AS forecast_created_at FROM wildfire_action_proposals p
           LEFT JOIN wildfire_forecasts f ON f.id=p.forecast_id WHERE p.id=$1 AND p.tenant_id=$2 FOR UPDATE OF p`,
          [req.params.proposalId, req.auth.tenantId],
        );
        if (!proposalResult.rowCount) throw new WildfireError('proposal_not_found', 'Proposal was not found');
        const proposal = proposalResult.rows[0];
        const approvalsResult = await client.query(
          `SELECT reviewer_id,role,decision,proposal_digest FROM wildfire_action_approvals
           WHERE proposal_id=$1 AND tenant_id=$2`, [req.params.proposalId, req.auth.tenantId],
        );
        if (approvalsResult.rows.some((approval) => approval.proposal_digest !== proposal.proposal_digest)) {
          throw new WildfireError('approval_digest_mismatch', 'Proposal changed after approval');
        }
        const authorization = authorizeDispatch({
          tenantId: req.auth.tenantId, proposalId: proposal.id, proposalDigest: proposal.proposal_digest,
          proposalStatus: proposal.status, feasible: proposal.feasible,
          forecastAgeMs: proposal.forecast_created_at ? Date.now() - new Date(proposal.forecast_created_at) : Infinity,
          maximumForecastAgeMs: req.body.maximumForecastAgeMs, manualFallback: proposal.manual_fallback,
          approvals: approvalsResult.rows.map((row) => ({ reviewerId: row.reviewer_id, role: row.role, decision: row.decision })),
          actorPermissions: req.auth.permissions,
        });
        const job = await client.query(
          `INSERT INTO wildfire_dispatch_jobs
             (id,tenant_id,proposal_id,idempotency_key,capability,status,payload,requested_by)
           VALUES ($1,$2,$3,$4,$5,'queued',$6::jsonb,$7)
           ON CONFLICT (tenant_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`,
          [authorization.dispatchId, req.auth.tenantId, proposal.id, authorization.idempotencyKey,
            proposal.kind, JSON.stringify({ proposalId: proposal.id, assetIds: proposal.asset_ids, siteId: proposal.site_id }), req.auth.userId],
        );
        await client.query("UPDATE wildfire_action_proposals SET status='queued',updated_at=now() WHERE id=$1", [proposal.id]);
        await audit(client, req.auth, 'dispatch.queued', 'dispatch_job', job.rows[0].id, { idempotencyKey: authorization.idempotencyKey });
        return job.rows[0];
      });
      return res.status(202).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/action-proposals/:proposalId/execution-events', requireRoles('incident_commander', 'operations', 'dispatcher'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const found = await client.query('SELECT * FROM wildfire_action_proposals WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.proposalId, req.auth.tenantId]);
        if (!found.rowCount) throw new WildfireError('proposal_not_found', 'Proposal was not found');
        const nextState = transitionAction({ status: found.rows[0].status }, req.body.nextStatus, req.body.evidence || {});
        const event = await client.query(
          `INSERT INTO wildfire_execution_events
             (tenant_id,proposal_id,event_type,source_system,source_event_id,payload,occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
           ON CONFLICT (tenant_id,source_system,source_event_id) DO NOTHING RETURNING *`,
          [req.auth.tenantId, req.params.proposalId, req.body.nextStatus, req.body.sourceSystem,
            req.body.sourceEventId, JSON.stringify(req.body.evidence || {}), req.body.occurredAt],
        );
        if (event.rowCount) await client.query('UPDATE wildfire_action_proposals SET status=$2,updated_at=now() WHERE id=$1', [req.params.proposalId, nextState.status]);
        return event.rowCount ? event.rows[0] : { duplicate: true };
      });
      return res.status(result.duplicate ? 200 : 202).json(result);
    } catch (error) { return next(error); }
  });

  router.post('/incidents/:incidentId/public-alerts', requireRoles('incident_commander', 'public_information_officer'), async (req, res, next) => {
    try {
      if (!req.body.officialZoneVersion || !req.body.capTemplateVersion || !req.body.payload || !req.body.sourceObservedAt) {
        throw new WildfireError('alert_evidence_missing', 'Official zone, CAP template, payload, and source timestamp are required');
      }
      const payloadDigest = digest(req.body.payload);
      const result = await pool.query(
        `INSERT INTO wildfire_public_alerts
           (tenant_id,incident_id,official_zone_version,cap_template_version,payload,payload_digest,translations,
            translations_verified,source_observed_at,status,created_by)
         SELECT $1,id,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,'draft',$10 FROM wildfire_incidents
         WHERE id=$2 AND tenant_id=$1 RETURNING *`,
        [req.auth.tenantId, req.params.incidentId, req.body.officialZoneVersion, req.body.capTemplateVersion,
          JSON.stringify(req.body.payload), payloadDigest, JSON.stringify(req.body.translations || {}),
          req.body.translationsVerified === true, req.body.sourceObservedAt, req.auth.userId],
      );
      if (!result.rowCount) throw new WildfireError('incident_not_found', 'Incident was not found');
      return res.status(201).json(result.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/public-alerts/:alertId/approvals', requireRoles('incident_commander', 'public_information_officer'), async (req, res, next) => {
    try {
      const result = await pool.query(
        `INSERT INTO wildfire_public_alert_approvals
           (tenant_id,alert_id,reviewer_id,role,decision,rationale,payload_digest)
         SELECT tenant_id,id,$3,$4,$5,$6,payload_digest FROM wildfire_public_alerts
         WHERE id=$1 AND tenant_id=$2 AND status IN ('draft','under_review')
         ON CONFLICT (alert_id,reviewer_id,role) DO UPDATE
           SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,decided_at=now()
         RETURNING *`,
        [req.params.alertId, req.auth.tenantId, req.auth.userId, req.auth.role, req.body.decision, req.body.rationale],
      );
      if (!result.rowCount) throw new WildfireError('alert_not_reviewable', 'Alert is not available for review');
      await pool.query("UPDATE wildfire_public_alerts SET status='under_review' WHERE id=$1 AND tenant_id=$2", [req.params.alertId, req.auth.tenantId]);
      return res.status(201).json(result.rows[0]);
    } catch (error) { return next(error); }
  });

  router.post('/public-alerts/:alertId/queue', requireRoles('incident_commander', 'public_information_officer'), async (req, res, next) => {
    try {
      const result = await transaction(pool, async (client) => {
        const alertResult = await client.query('SELECT * FROM wildfire_public_alerts WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [req.params.alertId, req.auth.tenantId]);
        if (!alertResult.rowCount) throw new WildfireError('alert_not_found', 'Alert was not found');
        const alert = alertResult.rows[0];
        const approvals = await client.query(
          `SELECT reviewer_id,role,decision,payload_digest FROM wildfire_public_alert_approvals
           WHERE alert_id=$1 AND tenant_id=$2`, [alert.id, req.auth.tenantId],
        );
        if (approvals.rows.some((approval) => approval.payload_digest !== alert.payload_digest)) {
          throw new WildfireError('alert_approval_digest_mismatch', 'Alert payload changed after approval');
        }
        authorizePublicAlert({
          officialZoneVersion: alert.official_zone_version, capTemplateVersion: alert.cap_template_version,
          sourceAgeMs: Date.now() - new Date(alert.source_observed_at), maximumSourceAgeMs: req.body.maximumSourceAgeMs,
          translationsVerified: alert.translations_verified, payload: alert.payload,
          approvals: approvals.rows.filter((row) => row.decision === 'approved').map((row) => ({ role: row.role, reviewerId: row.reviewer_id })),
          actorPermissions: req.auth.permissions,
        });
        const idempotencyKey = digest([req.auth.tenantId, alert.id, alert.payload_digest]);
        const outbox = await client.query(
          `INSERT INTO wildfire_provider_outbox
             (tenant_id,capability,aggregate_type,aggregate_id,command,payload_digest,idempotency_key)
           VALUES ($1,'notification','public_alert',$2,$3::jsonb,$4,$5)
           ON CONFLICT (tenant_id,capability,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
           RETURNING *`,
          [req.auth.tenantId, alert.id, JSON.stringify({ payload: alert.payload, translations: alert.translations }), alert.payload_digest, idempotencyKey],
        );
        await client.query("UPDATE wildfire_public_alerts SET status='queued' WHERE id=$1", [alert.id]);
        await audit(client, req.auth, 'public_alert.queued', 'public_alert', alert.id, { payloadDigest: alert.payload_digest });
        return outbox.rows[0];
      });
      return res.status(202).json(result);
    } catch (error) { return next(error); }
  });

  router.get('/incidents/:incidentId/status', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT i.id,i.incident_number,i.name,i.status,
           (SELECT count(*) FROM wildfire_telemetry_events e WHERE e.incident_id=i.id) telemetry_events,
           (SELECT count(*) FROM wildfire_forecasts f WHERE f.incident_id=i.id) forecasts,
           (SELECT count(*) FROM wildfire_action_proposals p WHERE p.incident_id=i.id) actions,
           (SELECT count(*) FROM wildfire_exceptions x WHERE x.incident_id=i.id AND x.status<>'resolved') open_exceptions
         FROM wildfire_incidents i WHERE i.id=$1 AND i.tenant_id=$2`,
        [req.params.incidentId, req.auth.tenantId],
      );
      return result.rowCount ? res.json(result.rows[0]) : res.status(404).json({ error: 'incident_not_found' });
    } catch (error) { return next(error); }
  });

  return router;
}

module.exports = { createGovernanceRouter, transaction };
