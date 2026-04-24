const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM spread_predictions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM spread_predictions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature } = req.body;
  try {
    const aiResponse = await queryAI(`Predict wildfire spread:
Fire: ${fire_name}, Current Size: ${current_acres} acres, Wind: ${wind_speed}mph ${wind_direction}, Terrain: ${terrain_type}, Vegetation Density: ${vegetation_density}, Humidity: ${humidity}%, Temp: ${temperature}°F.
Provide: 6/12/24/48-hour spread predictions with estimated acres, primary spread direction, rate of spread, potential containment lines, and communities at risk.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO spread_predictions (fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',$10) RETURNING *`,
      [fire_name, current_acres, wind_speed, wind_direction, terrain_type, vegetation_density, humidity, temperature, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
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

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM spread_predictions WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Update spread prediction for ${r.fire_name}: ${r.current_acres} acres, Wind ${r.wind_speed}mph ${r.wind_direction}, ${r.terrain_type} terrain. Provide updated spread forecast and containment strategy.`);
    await req.app.locals.pool.query('UPDATE spread_predictions SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
