// Custom feature endpoints (batch_09 audit suggestions)
const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

function parseJSON(t) {
  if (!t) return null;
  const c = String(t).replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const m = c.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function ask(prompt, system, res, label) {
  try {
    const resp = await queryAI(prompt, system);
    res.json({ type: label, result: parseJSON(resp) || { raw: resp } });
  } catch (e) {
    console.error(`${label} error:`, e.message);
    res.status(500).json({ error: e.message });
  }
}

// 1. Multi-model fire prediction (Rothermel + weather + LIDAR terrain)
router.post('/multi-model-prediction', auth, async (req, res) => {
  const { location, fuel_model, weather, terrain_lidar } = req.body || {};
  if (!location) return res.status(400).json({ error: 'location required' });
  return ask(
    `Run a multi-model fire prediction.\nLOCATION: ${location}\nFUEL: ${fuel_model || 'GR2'}\nWEATHER: ${JSON.stringify(weather || {})}\nTERRAIN_LIDAR: ${JSON.stringify(terrain_lidar || {})}\nReturn JSON {"rothermel":{"rate_of_spread_chh":0,"flame_length_ft":0},"ensemble_probability":0,"likely_run_direction":"","time_to_critical_h":0,"caveats":[""]}`,
    'You combine Rothermel surface-fire model with weather forecast and LIDAR terrain inputs. Reply JSON only.', res, 'multi-model-prediction'
  );
});

// 2. Evacuation zone modeling with traffic simulation
router.post('/evacuation-traffic', auth, async (req, res) => {
  const { zones, population, road_network } = req.body || {};
  if (!Array.isArray(zones)) return res.status(400).json({ error: 'zones required' });
  return ask(
    `Model evacuation traffic.\nZONES: ${JSON.stringify(zones.slice(0,20))}\nPOPULATION: ${population || 'unknown'}\nROADS: ${JSON.stringify(road_network || {})}\nReturn JSON {"evacuation_order":[{"zone":"","start_at":"","route":""}],"total_clearance_minutes":0,"bottlenecks":[""],"contraflow_needed":false}`,
    'You produce evacuation plans with traffic simulation outcomes. JSON only.', res, 'evacuation-traffic'
  );
});

// 3. Resource pre-positioning based on fire-index forecasts
router.post('/resource-prepositioning', auth, async (req, res) => {
  const { region, fire_index_forecast, available_resources } = req.body || {};
  if (!region) return res.status(400).json({ error: 'region required' });
  return ask(
    `Pre-position resources for forecast fire risk.\nREGION: ${region}\nFORECAST: ${JSON.stringify(fire_index_forecast || {})}\nRESOURCES: ${JSON.stringify(available_resources || [])}\nReturn JSON {"deployments":[{"resource_type":"engine|hand_crew|air_tanker","stage_location":"","count":0}],"rationale":"","reassess_in_h":12}`,
    'You stage firefighting resources ahead of forecast risk. JSON only.', res, 'resource-prepositioning'
  );
});

// 4. Drone-image damage assessment automation
// TODO: configure credentials for DRONE_IMAGE_PIPELINE_KEY.
router.post('/drone-damage-assessment', auth, async (req, res) => {
  const { incident_id, image_captions, area_acres } = req.body || {};
  if (!incident_id) return res.status(400).json({ error: 'incident_id required' });
  return ask(
    `Assess structural & vegetation damage from drone imagery captions. Drone pipeline configured: ${Boolean(process.env.DRONE_IMAGE_PIPELINE_KEY)}\nINCIDENT: ${incident_id}\nCAPTIONS: ${JSON.stringify(image_captions || [])}\nAREA_ACRES: ${area_acres || 0}\nReturn JSON {"structures_destroyed":0,"structures_damaged":0,"vegetation_burned_pct":0,"hotspots":[""],"recovery_priority":[""]}`,
    'You assess wildfire damage from aerial imagery descriptions. JSON only.', res, 'drone-damage-assessment'
  );
});

// 5. Utility power-shutoff coordination
// TODO: configure credentials for UTILITY_PSPS_API_KEY (PG&E PSPS feed).
router.post('/psps-coordination', auth, async (req, res) => {
  const { utility, affected_circuits, weather_window } = req.body || {};
  if (!utility) return res.status(400).json({ error: 'utility required' });
  return ask(
    `Coordinate Public Safety Power Shutoff (PSPS). Feed configured: ${Boolean(process.env.UTILITY_PSPS_API_KEY)}\nUTILITY: ${utility}\nCIRCUITS: ${JSON.stringify(affected_circuits || [])}\nWEATHER: ${JSON.stringify(weather_window || {})}\nReturn JSON {"recommended_shutoff_window":{"start":"","end":""},"affected_population":0,"medical_baseline_customers":0,"reenergize_checklist":[""]}`,
    'You coordinate utility power shutoff with emergency management. JSON only.', res, 'psps-coordination'
  );
});

// 6. Post-fire recovery planning
router.post('/recovery-planning', auth, async (req, res) => {
  const { incident_id, area_summary, community_needs } = req.body || {};
  if (!incident_id) return res.status(400).json({ error: 'incident_id required' });
  return ask(
    `Build a post-fire recovery plan.\nINCIDENT: ${incident_id}\nAREA: ${area_summary || ''}\nNEEDS: ${JSON.stringify(community_needs || {})}\nReturn JSON {"phases":[{"name":"","duration_weeks":0,"deliverables":[""]}],"funding_sources":[""],"environmental_actions":[""],"community_supports":[""]}`,
    'You plan multi-phase wildfire recovery (debris, watershed, housing, mental health). JSON only.', res, 'recovery-planning'
  );
});

// 7. Air-quality forecasting tied to community alerts
// TODO: configure credentials for AIRNOW_API_KEY.
router.post('/air-quality-alerts', auth, async (req, res) => {
  const { location, fire_distance_km, wind } = req.body || {};
  if (!location) return res.status(400).json({ error: 'location required' });
  return ask(
    `Forecast smoke / air quality and produce community alert copy. AirNow configured: ${Boolean(process.env.AIRNOW_API_KEY)}\nLOC: ${location}\nFIRE_DIST_KM: ${fire_distance_km || 'unknown'}\nWIND: ${JSON.stringify(wind || {})}\nReturn JSON {"aqi_forecast_24h":[0,0,0,0,0,0],"alert_level":"none|moderate|unhealthy|hazardous","public_message":"","vulnerable_groups":[""]}`,
    'You forecast wildfire smoke air quality and write public alert copy. JSON only.', res, 'air-quality-alerts'
  );
});

module.exports = router;
