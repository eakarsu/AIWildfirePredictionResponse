# Audit Recommendations & Status — AIWildfirePredictionResponse

Source: /Users/erolakarsu/projects/_AUDIT/reports/batch_09.md

Verdict per audit: skeleton-to-template — TSV claimed 0 AI. Inspection found ~11 AI endpoints already wired across `routes/aiFeatures.js` and `routes/aiCenter.js`. Audit was based on under-reported TSV.

## Original audit recommendations

Missing AI features (critical per audit):
- Fire spread prediction (already present: `/api/ai/fire-spread-predictor`)
- Property risk scoring (likely partially present in `aiCenter`)
- Evacuation route optimization
- Resource deployment optimization
- Damage severity prediction
- Community alert prioritization

Missing non-AI:
- Real-time dispatch
- Radio/communication integration
- Mutual-aid resource requests
- Insurance claim support

## Implemented in this pass

None. Project already has substantial AI surface across two AI route files. Adding more AI endpoints touches the existing files in their own domain language; the most useful next adds (resource deployment optimizer, community alert prioritization) are best done in a focused product pass rather than a generic mechanical edit.

## Backlog (priority order)

1. Resource deployment optimizer endpoint — text-only AI add-on; mechanical add-on.
2. Community-alert prioritization — text-only AI add-on.
3. Damage severity prediction (extending existing damage-assessments) — needs vision integration.
4. Mutual-aid resource requests — needs cross-agency API decisions.
5. Insurance claim support — credentials decision.

## Apply pass 3 (frontend)

- **FE stack:** CRA React 18 + axios (`frontend/`).
- **Action:** UPDATED-FE — added a page for the five `aiFeatures.js` endpoints that were orphaned (only the `aiCenter.js` endpoints had FE coverage).
- **Files modified:**
  - `frontend/src/pages/AIToolsExtra.js` (NEW) — five tool cards (`fire-spread-predictor`, `evacuation-route-optimizer`, `resource-allocation-planner`, `post-fire-damage-assessor`, `weather-risk-monitor`) with per-tool form, JSON-friendly result render, and 503-no-key handling.
  - `frontend/src/App.js` — `/ai-tools` route registered, `AIToolsExtra` import added.
  - `frontend/src/components/Sidebar.js` — added "AI Field Tools" link under "AI Center".
- JWT Bearer is attached via the existing axios interceptor in `services/api.js`.
- Out of scope (left untouched): `AICenter.js` posts to `/ai-center/risk-prediction|evacuation|resource-optimization|weather-fire|damage-recovery|...` but the backend `aiCenter.js` only exposes `query|quick-risk|sitrep|fire-behavior|prevention|training-scenario`. That's a pre-existing FE/BE path mismatch worth fixing in a focused pass.
- Syntax check: `@babel/parser` (jsx plugin) PASS on all three files.

## Apply pass 3 (Group A)

**Action:** DOCUMENTED-DECISION — the audit pass-3 note's "FE/BE path mismatch" is **incorrect on re-inspection**. No FE or BE changes required.

**Verification (line numbers in `frontend/src/pages/AICenter.js`):**
1. The `aiTools` array (lines 5–14) — `risk-prediction, evacuation, resource-optimization, weather-fire, damage-recovery, prevention, training, general` — is used **only as the `category` value** passed to `/ai-center/query` (line 57: `api.post('/ai-center/query', { prompt: input, category })`). It is NOT used as a URL path.
2. The backend `routes/aiCenter.js` `/query` handler (lines 6–22) explicitly maps every one of those category strings to a system prompt via `systemPrompts[category]`, with `'general'` as the fallback. So all eight category values are valid input.
3. The `quickTools` array (lines 16–38) keys — `quick-risk, sitrep, fire-behavior, prevention, training-scenario` — ARE used as URL path segments (line 70: `api.post('/ai-center/${toolKey}', ...)`). All five exist on the backend (`router.post('/quick-risk' | '/sitrep' | '/fire-behavior' | '/prevention' | '/training-scenario', ...)`).
4. Mount path is `/api/ai-center` (in `backend/src/index.js`), and the FE axios client baseURL is `/api`, so `api.post('/ai-center/...')` resolves to `/api/ai-center/...` — matches.

**Conclusion:** No path mismatch exists. The earlier audit note conflated the `aiTools` category strings with URL paths. Updated this `_AUDIT_NOTE.md` rather than touching code (idempotence rule).

**Backend 503 hardening (still backlog):** `backend/src/services/openrouter.js` does not return a structured 503 when `OPENROUTER_API_KEY` is missing; it always throws "AI service temporarily unavailable" which the routes turn into a 500. The FE shows the error message either way, but a structured 503 + canonical "AI not configured" message would let the FE display nicer guidance. Left as a small backend hardening backlog item — not a path mismatch.

**Files modified:** only this `_AUDIT_NOTE.md`.

**Syntax check:** N/A (no code changes). Re-parsed `AICenter.js` with `@babel/parser` (jsx plugin) PASS to confirm the verification was based on the current file content.

## Apply pass 4 (mechanical backlog)

Implemented the top two MECHANICAL backlog items (Resource deployment optimizer, Community alert prioritization).

**Backend (`backend/src/routes/aiFeatures.js`):**
- `POST /api/ai/resource-deployment-optimizer` — body `{ fires?, crews?, engines?, aircraft?, water_sources?, time_horizon_hours? }`. Returns JSON with per-fire ground assignments, air assignments, water-supply plan, staging areas, unassigned resources, key risks, rebalance triggers. Persists to `ai_results` (feature `resource_deployment_optimizer`).
- `POST /api/ai/community-alert-prioritization` — body `{ fires?, communities?, current_alerts?, weather? }`. Returns ranked alerts (with channels, headline, body, issue-within-minutes, rationale), downgrade recommendations, no-action items, messaging tips. Persists to `ai_results` (feature `community_alert_prioritization`).
- Both endpoints early-return **HTTP 503** with `{ error: 'AI service unavailable: OPENROUTER_API_KEY not configured' }` when the key is missing — addressing the pass-3 backend-hardening backlog for these two new routes (the older five existing in `aiFeatures.js` retain their original 500-on-error behavior; not touched per "don't touch working code").

**Frontend (`frontend/src/pages/AIToolsExtra.js`):**
- Added two new tool cards (`resource-deployment-optimizer`, `community-alert-prioritization`) to the existing TOOLS array.
- Extended the `ToolCard` component with a new `'json'` field type (monospace textarea, `JSON.parse` at submit time, error surfaces "Invalid JSON in <field>: <msg>"). All seven tools now share the same render/submit/error pipeline.
- 503 handling already in place — checks `err.response?.status === 503` and shows the canonical "AI service unavailable. Set OPENROUTER_API_KEY..." message. JWT Bearer is added by the existing axios interceptor in `services/api.js`.

**Smoke test (5/8/2026, OPENROUTER_API_KEY set):**
- `pkill` on 3001 → re-seeded `wildfire_db` → start `node src/index.js` → login `admin@wildfire.gov / password123` → `POST /api/ai/resource-deployment-optimizer` returns HTTP 200 with structured deployment plan (ground/air/water assignments) → cleanup.

**Syntax check:** `node --check` PASS on `aiFeatures.js`. `@babel/parser` (jsx plugin) PASS on `AIToolsExtra.js`.

**Backlog still deferred:** Damage severity prediction (vision integration, TOO-RISKY for mechanical pass), mutual-aid resource requests (NEEDS-PRODUCT-DECISION cross-agency APIs), insurance-claim support (NEEDS-CREDS).
