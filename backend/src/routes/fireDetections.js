const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

const SYSTEM_PROMPT = `You are an expert wildfire detection analyst. Always respond with valid JSON only — no markdown, no extra text.`;

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const total = (await req.app.locals.pool.query('SELECT COUNT(*) FROM fire_detections')).rows[0].count;
    const result = await req.app.locals.pool.query('SELECT * FROM fire_detections ORDER BY detected_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(total), totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM fire_detections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, aiRateLimiter, async (req, res) => {
  const { location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source } = req.body;
  try {
    const aiText = await queryAI(`Analyze fire detection report:
Location: ${location}, Sensor: ${sensor_type}, Confidence: ${confidence_level}%, Temperature: ${temperature}°F, Satellite: ${satellite_source}.

Return JSON:
{
  "severity": "Critical|High|Moderate|Low",
  "false_positive_probability": number,
  "estimated_fire_size_category": "Small|Medium|Large|Very Large",
  "immediate_actions": ["string"],
  "verification_steps": ["string"],
  "response_resources_needed": ["string"],
  "threat_to_structures": "Immediate|Potential|Minimal|None"
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    const result = await req.app.locals.pool.query(
      `INSERT INTO fire_detections (location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',$9) RETURNING *`,
      [location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, JSON.stringify(parsed || aiText), req.user.id]
    );
    try { await req.app.locals.pool.query(`INSERT INTO ai_results (feature, input_data, result_data, created_at) VALUES ($1,$2,$3,NOW())`, ['fire_detection', JSON.stringify(req.body), JSON.stringify(parsed || { raw: aiText })]); } catch (e) {}
    res.json({ ...result.rows[0], ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE fire_detections SET location=$1,latitude=$2,longitude=$3,sensor_type=$4,confidence_level=$5,temperature=$6,satellite_source=$7,status=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
      [location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM fire_detections WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM fire_detections WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiText = await queryAI(`Re-analyze fire detection: ${r.location}, Sensor: ${r.sensor_type}, Confidence: ${r.confidence_level}%, Temp: ${r.temperature}°F.
Return JSON: { "severity": "string", "false_positive_probability": number, "updated_actions": ["string"], "status_recommendation": "string" }`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    await req.app.locals.pool.query('UPDATE fire_detections SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(parsed || aiText), req.params.id]);
    res.json({ ai_analysis: parsed || { raw: aiText }, ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
