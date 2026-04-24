const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM weather_analyses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM weather_analyses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period } = req.body;
  try {
    const aiResponse = await queryAI(`Analyze weather conditions for wildfire risk:
Location: ${location}, Temp: ${temperature}°F, Humidity: ${humidity}%, Wind: ${wind_speed}mph ${wind_direction}, Precipitation: ${precipitation}in, Forecast Period: ${forecast_period}.
Provide: fire weather index, red flag warning assessment, wind-driven fire risk, drought impact analysis, and 48-hour fire weather outlook.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO weather_analyses (location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, ai_analysis, fire_weather_index, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [location, temperature, humidity, wind_speed, wind_direction, precipitation, forecast_period, aiResponse, req.body.fire_weather_index || 0, req.user.id]
    );
    res.json(result.rows[0]);
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

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM weather_analyses WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Update fire weather analysis for ${r.location}: Temp ${r.temperature}°F, Humidity ${r.humidity}%, Wind ${r.wind_speed}mph ${r.wind_direction}. Provide updated risk assessment and forecast.`);
    await req.app.locals.pool.query('UPDATE weather_analyses SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
