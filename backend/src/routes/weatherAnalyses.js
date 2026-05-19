const router = require('express').Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { queryAI, parseAIJson } = require('../services/openrouter');

const SYSTEM_PROMPT = `You are a fire weather meteorologist. Always respond with valid JSON only — no markdown, no extra text.`;

router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const total = (await req.app.locals.pool.query('SELECT COUNT(*) FROM weather_analyses')).rows[0].count;
    const result = await req.app.locals.pool.query('SELECT * FROM weather_analyses ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: result.rows, pagination: { page, limit, total: parseInt(total), totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM weather_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, aiRateLimiter, async (req, res) => {
  const { location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period } = req.body;
  try {
    const aiText = await queryAI(`Analyze weather conditions for wildfire risk:
Location: ${location}, Temp: ${temperature}°F, Humidity: ${humidity}%, Wind: ${wind_speed}mph at ${wind_direction}°, Precipitation: ${precipitation}in, Period: ${forecast_period}.

Return JSON:
{
  "fire_weather_index": number,
  "risk_level": "Extreme|Very High|High|Moderate|Low",
  "red_flag_conditions": boolean,
  "haines_index": number,
  "wind_driven_fire_risk": "Extreme|High|Moderate|Low",
  "drought_impact": "string",
  "48_hour_outlook": "string",
  "recommendations": ["string"],
  "watches_warnings": ["string"]
}`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    const fireWeatherIndex = parsed?.fire_weather_index || req.body.fire_weather_index || 0;
    const result = await req.app.locals.pool.query(
      `INSERT INTO weather_analyses (location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, ai_analysis, fire_weather_index, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, JSON.stringify(parsed || aiText), fireWeatherIndex, req.user.id]
    );
    try { await req.app.locals.pool.query(`INSERT INTO ai_results (feature, input_data, result_data, created_at) VALUES ($1,$2,$3,NOW())`, ['weather_analysis', JSON.stringify(req.body), JSON.stringify(parsed || { raw: aiText })]); } catch (e) {}
    res.json({ ...result.rows[0], ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, fire_weather_index } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE weather_analyses SET location=$1,temperature=$2,humidity=$3,wind_speed=$4,wind_direction=$5,precipitation=$6,forecast_period=$7,fire_weather_index=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
      [location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, fire_weather_index, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM weather_analyses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM weather_analyses WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiText = await queryAI(`Update fire weather analysis for ${r.location}: Temp ${r.temperature}°F, Humidity ${r.humidity}%, Wind ${r.wind_speed}mph at ${r.wind_direction}°.
Return JSON: { "fire_weather_index": number, "risk_level": "string", "red_flag_conditions": boolean, "updated_recommendations": ["string"] }`, SYSTEM_PROMPT);
    const parsed = parseAIJson(aiText);
    await req.app.locals.pool.query('UPDATE weather_analyses SET ai_analysis=$1,fire_weather_index=$2,updated_at=NOW() WHERE id=$3',
      [JSON.stringify(parsed || aiText), parsed?.fire_weather_index || r.fire_weather_index, req.params.id]);
    res.json({ ai_analysis: parsed || { raw: aiText }, ai_structured: parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
