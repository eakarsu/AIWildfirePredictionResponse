BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wildfire_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wildfire_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wildfire_memberships (
  tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id), user_id uuid NOT NULL REFERENCES wildfire_users(id),
  role text NOT NULL CHECK (role IN ('administrator','incident_commander','safety_officer','operations','dispatcher','public_information_officer','analyst','observer')),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id,user_id)
);
CREATE TABLE IF NOT EXISTS wildfire_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_number text NOT NULL, name text NOT NULL,
  status text NOT NULL CHECK (status IN ('monitoring','active','contained','closed')),
  command_version text NOT NULL, official_boundary jsonb NOT NULL, created_by uuid NOT NULL REFERENCES wildfire_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,incident_number), UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_id uuid NOT NULL, name text NOT NULL, boundary jsonb NOT NULL, access_policy jsonb NOT NULL,
  safety_limits jsonb NOT NULL, status text NOT NULL CHECK (status IN ('open','restricted','closed')),
  version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id), UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  asset_number text NOT NULL, kind text NOT NULL, capabilities jsonb NOT NULL, permitted_sites jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('available','assigned','maintenance','offline')),
  maintenance_due_at timestamptz, certification_expires_at timestamptz,
  crew_duty_minutes integer NOT NULL DEFAULT 0, maximum_duty_minutes integer NOT NULL,
  last_verified_at timestamptz NOT NULL, version bigint NOT NULL DEFAULT 1,
  UNIQUE (tenant_id,asset_number), UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_connector_checkpoints (
  tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id), source_system text NOT NULL,
  last_sequence bigint NOT NULL DEFAULT 0, last_event_id text, lease_token uuid, lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id,source_system)
);
CREATE TABLE IF NOT EXISTS wildfire_telemetry_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_id uuid NOT NULL, kind text NOT NULL, source_system text NOT NULL, source_event_id text NOT NULL,
  source_sequence bigint, schema_version text NOT NULL, observed_at timestamptz NOT NULL, received_at timestamptz NOT NULL,
  location jsonb, quality jsonb NOT NULL, payload jsonb NOT NULL, evidence_digest text NOT NULL,
  deduplication_key text NOT NULL, ingest_status text NOT NULL CHECK (ingest_status IN ('accepted','quarantined','duplicate')),
  quarantine_reason text, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id),
  UNIQUE (tenant_id,source_system,source_event_id), UNIQUE (tenant_id,deduplication_key)
);
CREATE TABLE IF NOT EXISTS wildfire_forecasts (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id), incident_id uuid NOT NULL,
  model_version text NOT NULL, configuration_version text NOT NULL, evidence_digests jsonb NOT NULL,
  horizons_minutes jsonb NOT NULL, perimeter_envelopes jsonb NOT NULL, uncertainty jsonb NOT NULL,
  assumptions jsonb NOT NULL, limitations jsonb NOT NULL, forecast_digest text NOT NULL,
  status text NOT NULL CHECK (status IN ('advisory','superseded','invalidated')),
  created_by uuid NOT NULL REFERENCES wildfire_users(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id), UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_replay_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_id uuid NOT NULL, forecast_id uuid REFERENCES wildfire_forecasts(id), scenario_version text NOT NULL,
  passed boolean NOT NULL, failures jsonb NOT NULL, metrics jsonb NOT NULL, realized_outcome jsonb NOT NULL,
  evaluator_version text NOT NULL, created_by uuid NOT NULL REFERENCES wildfire_users(id),
  created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_action_proposals (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id), incident_id uuid NOT NULL,
  kind text NOT NULL, site_id uuid NOT NULL REFERENCES wildfire_sites(id), forecast_id uuid REFERENCES wildfire_forecasts(id),
  asset_ids jsonb NOT NULL, constraints jsonb NOT NULL, objective jsonb NOT NULL, violations jsonb NOT NULL,
  feasible boolean NOT NULL, manual_fallback text NOT NULL, communication_plan text NOT NULL,
  proposal_digest text NOT NULL, status text NOT NULL CHECK (status IN ('proposed','under_review','approved','rejected','queued','dispatched','acknowledged','executing','completed','exception','failed','cancelled')),
  created_by uuid NOT NULL REFERENCES wildfire_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id), UNIQUE (tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_action_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  proposal_id uuid NOT NULL REFERENCES wildfire_action_proposals(id), reviewer_id uuid NOT NULL REFERENCES wildfire_users(id),
  role text NOT NULL CHECK (role IN ('incident_commander','safety_officer','public_information_officer')),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')), rationale text NOT NULL,
  proposal_digest text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id,reviewer_id,role)
);
CREATE TABLE IF NOT EXISTS wildfire_dispatch_jobs (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id), proposal_id uuid NOT NULL REFERENCES wildfire_action_proposals(id),
  idempotency_key text NOT NULL, capability text NOT NULL, status text NOT NULL CHECK (status IN ('queued','claimed','dispatched','acknowledged','failed','dead_letter','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5), next_attempt_at timestamptz,
  lease_token uuid, lease_expires_at timestamptz, payload jsonb NOT NULL, last_error_code text,
  requested_by uuid NOT NULL REFERENCES wildfire_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS wildfire_execution_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  proposal_id uuid NOT NULL REFERENCES wildfire_action_proposals(id), event_type text NOT NULL,
  source_system text NOT NULL, source_event_id text NOT NULL, payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,source_system,source_event_id)
);
CREATE TABLE IF NOT EXISTS wildfire_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_id uuid NOT NULL, proposal_id uuid REFERENCES wildfire_action_proposals(id), code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')), details jsonb NOT NULL,
  manual_fallback_activated boolean NOT NULL DEFAULT false, status text NOT NULL CHECK (status IN ('open','mitigating','resolved')),
  opened_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_public_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  incident_id uuid NOT NULL, official_zone_version text NOT NULL, cap_template_version text NOT NULL,
  payload jsonb NOT NULL, payload_digest text NOT NULL, translations jsonb NOT NULL,
  translations_verified boolean NOT NULL DEFAULT false, source_observed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','under_review','approved','queued','sent','failed','cancelled')),
  created_by uuid NOT NULL REFERENCES wildfire_users(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,incident_id) REFERENCES wildfire_incidents(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS wildfire_public_alert_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  alert_id uuid NOT NULL REFERENCES wildfire_public_alerts(id), reviewer_id uuid NOT NULL REFERENCES wildfire_users(id),
  role text NOT NULL CHECK (role IN ('incident_commander','public_information_officer')),
  decision text NOT NULL CHECK (decision IN ('approved','rejected','changes_requested')), rationale text NOT NULL,
  payload_digest text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id,reviewer_id,role)
);
CREATE TABLE IF NOT EXISTS wildfire_provider_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  capability text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  command jsonb NOT NULL, payload_digest text NOT NULL, idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','delivered','retry','dead_letter','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  lease_token uuid, lease_expires_at timestamptz, next_attempt_at timestamptz, last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,capability,idempotency_key)
);
CREATE TABLE IF NOT EXISTS wildfire_integration_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  capability text NOT NULL, aggregate_id uuid NOT NULL, provider text NOT NULL, receipt_id text NOT NULL,
  external_id text, remote_status text NOT NULL, usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_digest text NOT NULL, occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider,receipt_id)
);
CREATE TABLE IF NOT EXISTS wildfire_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES wildfire_tenants(id),
  actor_id uuid REFERENCES wildfire_users(id), action text NOT NULL, entity_type text NOT NULL,
  entity_id uuid NOT NULL, evidence jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION wildfire_reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'wildfire evidence is append-only'; END $$;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['wildfire_telemetry_events','wildfire_forecasts','wildfire_replay_evaluations','wildfire_action_approvals','wildfire_execution_events','wildfire_public_alert_approvals','wildfire_integration_receipts','wildfire_audit_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS immutable_evidence ON %I',table_name);
    EXECUTE format('CREATE TRIGGER immutable_evidence BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION wildfire_reject_evidence_mutation()',table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['wildfire_memberships','wildfire_incidents','wildfire_sites','wildfire_assets','wildfire_connector_checkpoints','wildfire_telemetry_events','wildfire_forecasts','wildfire_replay_evaluations','wildfire_action_proposals','wildfire_action_approvals','wildfire_dispatch_jobs','wildfire_execution_events','wildfire_exceptions','wildfire_public_alerts','wildfire_public_alert_approvals','wildfire_provider_outbox','wildfire_integration_receipts','wildfire_audit_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I',table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',table_name);
  END LOOP;
END $$;
COMMIT;
