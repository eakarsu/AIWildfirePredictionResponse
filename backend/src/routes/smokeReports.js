const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

const SYSTEM_PROMPT = `You are a wildfire smoke analyst. Always respond with valid JSON only — no markdown, no extra text.`;

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const total = (await req.app.locals.pool.query('SELECT COUNT(*) FROM smoke_reports')).rows[0].count;
    const result = await req.app.locals.pool.query('SELECT * FROM smoke_reports ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(total), totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM smoke_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, aiRateLimiter, async (req, res) => {
  const { location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description } = req.body;
  try {
    const aiText = await queryAI(`Analyze smoke report:
Location: ${location} (${latitude}, ${longitude}), Color: ${smoke_color}, Density: ${smoke_density}, Wind: ${wind_direction}, Description: ${description}.

Return JSON:
{
  "likely_fire_type": "string",
  "estimated_distance_miles": number,
  "response_level": "Immediate|Urgent|Monitor|Low",
  "air_quality_impact": "Hazardous|Very Unhealthy|Unhealthy|Moderate|Good",
  "public_health_advisory": "string",
  "recommended_actions": ["string"]
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    const result = await req.app.locals.pool.query(
      `INSERT INTO smoke_reports (location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Reported',$10) RETURNING *`,
      [location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, JSON.stringify(parsed || aiText), req.user.id]
    );
    try { await req.app.locals.pool.query(`INSERT INTO ai_results (feature, input_data, result_data, created_at) VALUES ($1,$2,$3,NOW())`, ['smoke_report', JSON.stringify(req.body), JSON.stringify(parsed || { raw: aiText })]); } catch (e) {}
    res.json({ ...result.rows[0], ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE smoke_reports SET location=$1,latitude=$2,longitude=$3,smoke_color=$4,smoke_density=$5,wind_direction=$6,reporter_name=$7,description=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM smoke_reports WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM smoke_reports WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiText = await queryAI(`Re-analyze smoke at ${r.location}: Color: ${r.smoke_color}, Density: ${r.smoke_density}. ${r.description}.
Return JSON: { "likely_fire_type": "string", "response_level": "string", "air_quality_impact": "string", "updated_actions": ["string"] }`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    await req.app.locals.pool.query('UPDATE smoke_reports SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(parsed || aiText), req.params.id]);
    res.json({ ai_analysis: parsed || { raw: aiText }, ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
