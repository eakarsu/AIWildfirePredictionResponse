# Governed Wildfire Prediction and Response Operations

## Safety boundary

The supported service is `/api/governance`. Forecasts and resource optimizations are advisory evidence; neither may automatically dispatch people or equipment, change utility state, issue an evacuation, or send a public alert. Consequential dispatch requires a feasible, current proposal bound to a pinned forecast and live asset/site versions, an explicit manual fallback and communications plan, distinct incident-commander and safety-officer approvals over the same digest, and a caller with dispatch permission. Public alerts additionally require the current official zone and CAP template, verified translations, fresh sources, and incident-commander plus public-information-officer approval.

Operators remain responsible for incident-command decisions. When the service, provider, network, location feed, or device state is uncertain, use established radio/CAD and paper fallback procedures; never infer that a queued or timed-out command was delivered.

## Installation and startup

1. Run `scripts/bootstrap.sh` explicitly to install pinned dependencies.
2. Copy `.env.example` to `.env` and supply values through the deployment secret manager. JWTs require a strong secret, issuer, audience, user subject, and tenant claim.
3. Review and back up the selected PostgreSQL target, then run `./start.sh migrate` using a migration identity.
4. Provision tenants, users, roles/permissions, incidents, sites, certified assets, and connector identities through an approved administrative process. No demo credentials or operational records are seeded.
5. Run `./start.sh check`, then `./start.sh start` with a least-privileged service identity. Production requires verified database TLS.

Startup does not install packages, start PostgreSQL, create or seed databases, apply migrations, kill processes, or take ports. Frontend startup is separately managed by the deployment platform.

## Connectors, offline operation, and recovery

Weather, GIS, fire detection, CAD/radio, SCADA/utility, ERP/WMS/TMS, asset, maintenance, air-quality, and notification integrations must implement the typed adapter contract. Inbound events carry authoritative source IDs, monotonic sequences, schema versions, observation/receipt timestamps, location/quality metadata, and digests. Duplicates are idempotent; a sequence gap pauses that connector for reconciliation. Late, stale, or future events are quarantined rather than silently used.

Outbound work uses payload-bound idempotency, claim leases, at most five retries, typed failures, and durable non-secret receipts. On timeout, reconcile the provider/CAD state before retry. Dead letters require an incident operator to choose retry, manual execution, or cancellation. Offline field clients retain an encrypted ordered queue and must reconcile sequence, asset version, and incident status before upload; conflicts never overwrite accepted evidence.

Execution feedback records acknowledgement, start, exception, completion, and realized outcome. A safety limit, route closure, maintenance condition, crew-duty limit, telemetry expiry, lost acknowledgement, or asset-version conflict stops further automation and activates the recorded manual fallback. Record any real-world action taken outside the service as a new execution event.

## Monitoring and continuity

Alert on connector gaps/lag, quarantined events, forecast evidence age, replay threshold failures, proposal constraint violations, pending approvals, dispatch lease expiry, ambiguous receipts, dead letters, unacknowledged actions, open critical exceptions, and public-alert delivery reconciliation. Back up PostgreSQL and immutable evidence storage; restore into isolation and verify digests/checkpoints before reconnecting adapters. Exercise failover with CAD/radio, GIS/weather, notification, and database providers unavailable.

## External validation still required

Source changes cannot establish operational safety or predictive performance. Before use, emergency-management owners must certify actual CAD/radio, GIS, weather, detection/device, SCADA/utility, ERP/WMS/TMS, maintenance, air-quality, asset, and notification adapters; apply the migration and verify RLS with production roles; replay representative historical incidents with approved ground truth and acceptance thresholds; run shadow-mode and supervised field exercises; validate model/calibration limits across fuels, terrain, weather, and sensor failure; test accessibility, multilingual public alerts, offline clients, load, browser, security, backup/restore, disaster recovery, and incident procedures; and obtain incident-command, fire-behavior, safety, privacy, accessibility, public-information, utility, and legal approval. Credentials, operational data, hardware, providers, and professional certification are external blockers.
