const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

const SYSTEM_PROMPT = `You are a fire behavior analyst expert in fire spread physics (Rothermel model). Always respond with valid JSON only — no markdown, no extra text.`;

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const total = (await req.app.locals.pool.query('SELECT COUNT(*) FROM spread_predictions')).rows[0].count;
    const result = await req.app.locals.pool.query('SELECT * FROM spread_predictions ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(total), totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM spread_predictions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, aiRateLimiter, async (req, res) => {
  const { fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature } = req.body;
  try {
    const aiText = await queryAI(`Predict wildfire spread using fire physics:
Fire: ${fire_name}, Current Size: ${current_acres} acres
Wind: ${wind_speed}mph at ${wind_direction} degrees
Terrain: ${terrain_type}, Vegetation Density: ${vegetation_density}
Humidity: ${humidity}%, Temperature: ${temperature}°F

Return JSON:
{
  "fire_name": "string",
  "predictions": {
    "6_hour": { "estimated_acres": number, "spread_direction": "string", "rate_of_spread_chains_per_hour": number },
    "12_hour": { "estimated_acres": number, "spread_direction": "string", "rate_of_spread_chains_per_hour": number },
    "24_hour": { "estimated_acres": number, "spread_direction": "string", "rate_of_spread_chains_per_hour": number },
    "48_hour": { "estimated_acres": number, "spread_direction": "string", "rate_of_spread_chains_per_hour": number }
  },
  "flame_length_feet": number,
  "spotting_potential": "Low|Moderate|High|Extreme",
  "crown_fire_potential": "Low|Moderate|High|Extreme",
  "communities_at_risk": ["string"],
  "containment_lines": ["string"],
  "suppression_tactics": ["string"]
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    const result = await req.app.locals.pool.query(
      `INSERT INTO spread_predictions (fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',$10) RETURNING *`,
      [fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, JSON.stringify(parsed || aiText), req.user.id]
    );
    try {
      await req.app.locals.pool.query(
        `INSERT INTO ai_results (feature, input_data, result_data, created_at) VALUES ($1,$2,$3,NOW())`,
        ['spread_prediction', JSON.stringify(req.body), JSON.stringify(parsed || { raw: aiText })]
      );
    } catch (e) {}
    res.json({ ...result.rows[0], ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE spread_predictions SET fire_name=$1,current_acres=$2,wind_speed=$3,wind_direction=$4,terrain_type=$5,vegetation_density=$6,humidity=$7,temperature=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM spread_predictions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM spread_predictions WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiText = await queryAI(`Update fire spread prediction for ${r.fire_name}: ${r.current_acres} acres, Wind ${r.wind_speed}mph at ${r.wind_direction}°, ${r.terrain_type} terrain, ${r.humidity}% humidity.

Return JSON:
{
  "predictions": {
    "6_hour": { "estimated_acres": number, "spread_direction": "string" },
    "12_hour": { "estimated_acres": number, "spread_direction": "string" },
    "24_hour": { "estimated_acres": number, "spread_direction": "string" }
  },
  "updated_containment_strategy": ["string"],
  "risk_change": "Increasing|Stable|Decreasing"
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    await req.app.locals.pool.query('UPDATE spread_predictions SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(parsed || aiText), req.params.id]);
    res.json({ ai_analysis: parsed || { raw: aiText }, ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
