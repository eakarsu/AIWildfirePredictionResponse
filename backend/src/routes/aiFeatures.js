const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

// Helper to persist AI results
async function saveAIResult(pool, feature, inputData, resultData) {
  try {
    await pool.query(
      `INSERT INTO ai_results (feature, input_data, result_data, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [feature, JSON.stringify(inputData), JSON.stringify(resultData)]
    );
  } catch (err) {
    // Table may not exist yet — log and continue
    console.error('ai_results insert error:', err.message);
  }
}

// POST /api/ai/fire-spread-predictor
// Given wind speed/direction, terrain, fuel moisture, vegetation type — predict spread radius
router.post('/fire-spread-predictor', auth, aiRateLimiter, async (req, res) => {
  const { wind_speed, wind_direction, terrain, fuel_moisture, vegetation_type, fire_name, current_acres } = req.body;
  try {
    const systemPrompt = `You are an expert fire behavior scientist using fire spread physics models (Rothermel, Huygens).
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Predict wildfire spread using fire physics for:
Fire Name: ${fire_name || 'Unknown Fire'}
Current Size: ${current_acres || 0} acres
Wind Speed: ${wind_speed} mph
Wind Direction: ${wind_direction} degrees (meteorological)
Terrain: ${terrain}
Fuel Moisture: ${fuel_moisture}%
Vegetation Type: ${vegetation_type}

Return JSON:
{
  "fire_name": "string",
  "current_acres": number,
  "predictions": {
    "6_hour": { "estimated_acres": number, "spread_direction": "string", "spread_rate_chains_per_hour": number, "spotting_distance_miles": number },
    "12_hour": { "estimated_acres": number, "spread_direction": "string", "spread_rate_chains_per_hour": number, "spotting_distance_miles": number },
    "24_hour": { "estimated_acres": number, "spread_direction": "string", "spread_rate_chains_per_hour": number, "spotting_distance_miles": number }
  },
  "fire_behavior": {
    "flame_length_feet": number,
    "rate_of_spread_chains_per_hour": number,
    "crown_fire_potential": "Low|Moderate|High|Extreme",
    "spotting_potential": "Low|Moderate|High|Extreme",
    "fireline_intensity_btu_per_ft_per_sec": number
  },
  "communities_at_risk": ["string"],
  "containment_lines": ["string"],
  "recommended_resources": ["string"],
  "confidence": "Low|Moderate|High",
  "model_used": "Rothermel"
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'fire_spread_predictor', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/evacuation-route-optimizer
// Given fire location and zones, generate optimal evacuation routes
router.post('/evacuation-route-optimizer', auth, aiRateLimiter, async (req, res) => {
  const { fire_location, fire_acres, zones, road_network_description, wind_direction } = req.body;
  try {
    const systemPrompt = `You are an emergency management specialist expert in evacuation logistics and traffic management.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Optimize evacuation routes for:
Fire Location: ${fire_location}
Fire Size: ${fire_acres} acres
Wind Direction: ${wind_direction} (determines fire spread direction)
Zones to Evacuate: ${zones || 'All zones in affected area'}
Road Network: ${road_network_description || 'Standard suburban road network'}

Return JSON:
{
  "evacuation_zones": [
    {
      "zone_id": "string",
      "zone_name": "string",
      "priority": "Immediate|Urgent|Watch|Warning",
      "estimated_population": number,
      "primary_route": "string",
      "alternate_route": "string",
      "assembly_point": "string",
      "estimated_evacuation_time_minutes": number,
      "special_considerations": ["string"]
    }
  ],
  "contraflow_needed": boolean,
  "contraflow_roads": ["string"],
  "traffic_management_points": ["string"],
  "special_needs_transport": {
    "estimated_count": number,
    "pickup_points": ["string"],
    "transport_resources_needed": number
  },
  "phase_plan": [
    { "phase": number, "time_minutes": number, "action": "string", "zones": ["string"] }
  ],
  "total_estimated_evacuation_time_hours": number,
  "critical_bottlenecks": ["string"],
  "recommendations": ["string"]
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'evacuation_route_optimizer', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/resource-allocation-planner
// Given multiple active fires and available units, optimally allocate firefighting resources
router.post('/resource-allocation-planner', auth, aiRateLimiter, async (req, res) => {
  const { active_fires, available_resources } = req.body;
  try {
    const systemPrompt = `You are an Incident Command System (ICS) resource management expert.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Optimally allocate firefighting resources across multiple active fires:

Active Fires:
${JSON.stringify(active_fires, null, 2)}

Available Resources:
${JSON.stringify(available_resources, null, 2)}

Return JSON:
{
  "allocation_plan": [
    {
      "fire_id": "string",
      "fire_name": "string",
      "priority_rank": number,
      "priority_rationale": "string",
      "allocated_resources": [
        { "resource_type": "string", "quantity": number, "role": "string" }
      ],
      "estimated_containment_hours": number,
      "resource_adequacy": "Sufficient|Marginal|Insufficient"
    }
  ],
  "unallocated_resources": [
    { "resource_type": "string", "quantity": number, "recommended_staging": "string" }
  ],
  "mutual_aid_needed": boolean,
  "mutual_aid_request": { "resource_type": "string", "quantity": number, "urgency": "string" },
  "estimated_total_cost_per_day": number,
  "strategic_recommendations": ["string"],
  "risk_assessment": "string"
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'resource_allocation_planner', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/post-fire-damage-assessor
// Analyze incident data to estimate damage, ecological impact, recovery timeline
router.post('/post-fire-damage-assessor', auth, aiRateLimiter, async (req, res) => {
  const { incident_name, location, acres_burned, structures_damaged, structures_destroyed, vegetation_type, watershed_affected, injuries, fatalities, estimated_cost } = req.body;
  try {
    const systemPrompt = `You are a post-fire damage assessment specialist with expertise in ecology, property assessment, and disaster recovery.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Perform comprehensive post-fire damage assessment:
Incident: ${incident_name}
Location: ${location}
Acres Burned: ${acres_burned}
Structures Damaged: ${structures_damaged}
Structures Destroyed: ${structures_destroyed}
Vegetation Type: ${vegetation_type || 'Mixed conifer/chaparral'}
Watershed Affected: ${watershed_affected || 'Unknown'}
Injuries: ${injuries}
Fatalities: ${fatalities}
Preliminary Cost Estimate: $${estimated_cost}

Return JSON:
{
  "overall_severity": "Catastrophic|Severe|Major|Moderate|Minor",
  "damage_summary": {
    "property_damage_estimate_usd": number,
    "ecological_damage_score": number,
    "recovery_difficulty": "Extreme|High|Moderate|Low"
  },
  "ecological_impact": {
    "vegetation_recovery_years": number,
    "watershed_risk": "Critical|High|Moderate|Low",
    "erosion_risk": "Critical|High|Moderate|Low",
    "species_habitat_impact": "string",
    "flood_risk_years": number,
    "reforestation_needed_acres": number
  },
  "recovery_timeline": {
    "immediate_0_30_days": ["string"],
    "short_term_1_6_months": ["string"],
    "medium_term_6_24_months": ["string"],
    "long_term_2_10_years": ["string"]
  },
  "federal_aid": {
    "fema_eligibility": boolean,
    "fema_programs": ["string"],
    "estimated_federal_assistance_usd": number,
    "application_priority": "High|Medium|Low"
  },
  "infrastructure_priorities": [
    { "category": "string", "priority": number, "estimated_cost_usd": number, "timeline_months": number }
  ],
  "community_support_needs": ["string"],
  "recommendations": ["string"]
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'post_fire_damage_assessor', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/weather-risk-monitor
// Given forecast data, predict fire weather conditions and issue risk alerts
router.post('/weather-risk-monitor', auth, aiRateLimiter, async (req, res) => {
  const { location, forecast_data, current_drought_index, fuel_moisture } = req.body;
  try {
    const systemPrompt = `You are a fire weather meteorologist specializing in Red Flag conditions and fire weather watches.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Analyze fire weather risk:
Location: ${location}
Forecast Data: ${JSON.stringify(forecast_data)}
Current Drought Index: ${current_drought_index || 'Unknown'}
Current Fuel Moisture: ${fuel_moisture || 'Unknown'}%

Return JSON:
{
  "location": "string",
  "overall_risk_level": "Extreme|Very High|High|Moderate|Low",
  "risk_score": number,
  "red_flag_conditions": boolean,
  "red_flag_criteria_met": ["string"],
  "fire_weather_watch": boolean,
  "daily_forecast": [
    {
      "date": "string",
      "risk_level": "Extreme|Very High|High|Moderate|Low",
      "max_temp_f": number,
      "min_humidity_pct": number,
      "wind_speed_mph": number,
      "wind_direction": "string",
      "gusts_mph": number,
      "fuel_moisture_pct": number,
      "haines_index": number,
      "key_factors": ["string"]
    }
  ],
  "critical_periods": [
    { "start_time": "string", "end_time": "string", "conditions": "string", "risk": "string" }
  ],
  "recommended_actions": {
    "fire_agencies": ["string"],
    "public": ["string"],
    "utilities": ["string"]
  },
  "outlook_7_day": "string"
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'weather_risk_monitor', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/resource-deployment-optimizer
// Optimal real-time deployment plan: where to send each crew/engine/aircraft right now
router.post('/resource-deployment-optimizer', auth, aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured' });
  }
  const { fires, crews, engines, aircraft, water_sources, time_horizon_hours } = req.body || {};
  try {
    const systemPrompt = `You are an Incident Command System (ICS) operations chief expert in real-time resource deployment, ground/air coordination, and water-source logistics.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Produce an optimal deployment plan for the next ${time_horizon_hours || 12} hours:

Active Fires: ${JSON.stringify(fires || [], null, 2)}
Crews (hand crews / hotshots / type-2): ${JSON.stringify(crews || [], null, 2)}
Engines / dozers: ${JSON.stringify(engines || [], null, 2)}
Aircraft (helicopters / SEATs / VLATs): ${JSON.stringify(aircraft || [], null, 2)}
Water sources / hydrants / dip sites: ${JSON.stringify(water_sources || [], null, 2)}

Return JSON:
{
  "horizon_hours": number,
  "deployments": [
    {
      "fire_id": "string",
      "fire_name": "string",
      "objective": "string",
      "ground_assignments": [{"resource_id":"string","role":"string","division":"string","eta_minutes":number}],
      "air_assignments": [{"resource_id":"string","mission":"string","drop_target":"string","sortie_count":number}],
      "water_supply_plan": [{"source_id":"string","route":"string","gpm":number}]
    }
  ],
  "staging_areas": [{"name":"string","resources_held":["string"],"reason":"string"}],
  "unassigned_resources": [{"resource_id":"string","reason":"string"}],
  "key_risks": ["string"],
  "rebalance_triggers": ["string"]
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'resource_deployment_optimizer', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/community-alert-prioritization
// Rank pending community alerts/zones by urgency given current fire posture
router.post('/community-alert-prioritization', auth, aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY not configured' });
  }
  const { fires, communities, current_alerts, weather } = req.body || {};
  try {
    const systemPrompt = `You are an emergency public information officer expert in alert messaging (Wireless Emergency Alerts, IPAWS, CodeRED) and risk-tier-based prioritization.
Always respond with valid JSON only — no markdown, no extra text.`;
    const prompt = `Prioritize community alerts given current fire posture:

Active Fires: ${JSON.stringify(fires || [], null, 2)}
Communities / zones: ${JSON.stringify(communities || [], null, 2)}
Existing alerts: ${JSON.stringify(current_alerts || [], null, 2)}
Weather: ${JSON.stringify(weather || {}, null, 2)}

Return JSON:
{
  "prioritized_alerts": [
    {
      "rank": number,
      "community_id": "string",
      "community_name": "string",
      "alert_level": "Evacuation Order|Evacuation Warning|Shelter In Place|Watch|Advisory",
      "channels": ["WEA","IPAWS","CodeRED","Reverse 911","Social"],
      "headline": "string",
      "body": "string",
      "issue_within_minutes": number,
      "rationale": "string"
    }
  ],
  "downgrade_recommendations": [{"community_id":"string","new_level":"string","reason":"string"}],
  "no_action": [{"community_id":"string","reason":"string"}],
  "messaging_tips": ["string"]
}`;

    const aiText = await queryAI(prompt, systemPrompt);
    const parsed = parseAIJson(aiText);
    const result = parsed || { raw_analysis: aiText };

    await saveAIResult(req.app.locals.pool, 'community_alert_prioritization', req.body, result);

    res.json({ result, ai_raw: parsed ? undefined : aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
