const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

const SYSTEM_PROMPT = `You are an expert wildfire risk assessment scientist. Always respond with valid JSON only — no markdown, no extra text.`;

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const total = (await req.app.locals.pool.query('SELECT COUNT(*) FROM risk_assessments')).rows[0].count;
    const result = await req.app.locals.pool.query('SELECT * FROM risk_assessments ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(total), totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM risk_assessments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, aiRateLimiter, async (req, res) => {
  const { location, latitude, longitude, vegetation_type, terrain, weather_conditions } = req.body;
  try {
    const aiPrompt = `Analyze wildfire risk for:
Location: ${location}
Coordinates: ${latitude}, ${longitude}
Vegetation: ${vegetation_type}
Terrain: ${terrain}
Weather: ${weather_conditions}

Return JSON:
{
  "risk_level": "Critical|High|Medium|Low",
  "risk_score": number,
  "risk_factors": ["string"],
  "recommendations": ["string"],
  "immediate_actions": ["string"],
  "detailed_analysis": "string",
  "probability_ignition_24h": number,
  "probability_major_fire_7d": number
}`;

    const aiText = await queryAI(aiPrompt, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    const riskLevel = parsed?.risk_level || req.body.risk_level || 'Pending';
    const riskScore = parsed?.risk_score || req.body.risk_score || 0;

    const result = await req.app.locals.pool.query(
      `INSERT INTO risk_assessments (location, latitude, longitude, vegetation_type, terrain, weather_conditions, ai_analysis, risk_level, risk_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [location, latitude, longitude, vegetation_type, terrain, weather_conditions, JSON.stringify(parsed || aiText), riskLevel, riskScore, req.user.id]
    );

    // Persist to ai_results
    try {
      await req.app.locals.pool.query(
        `INSERT INTO ai_results (feature, input_data, result_data, created_at) VALUES ($1,$2,$3,NOW())`,
        ['risk_assessment', JSON.stringify(req.body), JSON.stringify(parsed || { raw: aiText })]
      );
    } catch (e) {}

    res.json({ ...result.rows[0], ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { location, latitude, longitude, vegetation_type, terrain, weather_conditions, risk_level, risk_score } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE risk_assessments SET location=$1, latitude=$2, longitude=$3, vegetation_type=$4, terrain=$5, weather_conditions=$6, risk_level=$7, risk_score=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [location, latitude, longitude, vegetation_type, terrain, weather_conditions, risk_level, risk_score, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM risk_assessments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM risk_assessments WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiText = await queryAI(`Provide updated wildfire risk assessment for:
Location: ${r.location}, Vegetation: ${r.vegetation_type}, Terrain: ${r.terrain}, Weather: ${r.weather_conditions}.

Return JSON:
{
  "risk_level": "Critical|High|Medium|Low",
  "risk_score": number,
  "risk_factors": ["string"],
  "recommendations": ["string"],
  "immediate_actions": ["string"],
  "detailed_analysis": "string"
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    await req.app.locals.pool.query('UPDATE risk_assessments SET ai_analysis=$1, risk_level=$2, risk_score=$3, updated_at=NOW() WHERE id=$4',
      [JSON.stringify(parsed || aiText), parsed?.risk_level || r.risk_level, parsed?.risk_score || r.risk_score, req.params.id]);
    res.json({ ai_analysis: parsed || { raw: aiText }, ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
