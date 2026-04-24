const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM fire_detections ORDER BY detected_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM fire_detections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source } = req.body;
  try {
    const aiResponse = await queryAI(`Analyze this fire detection report and provide assessment:
Location: ${location}, Sensor: ${sensor_type}, Confidence: ${confidence_level}%, Temperature: ${temperature}°F, Satellite: ${satellite_source}.
Provide: severity assessment, recommended immediate actions, estimated fire size category, and false positive probability.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO fire_detections (location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Active',$9) RETURNING *`,
      [location, latitude, longitude, sensor_type, confidence_level, temperature, satellite_source, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
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

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM fire_detections WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-analyze fire detection: Location: ${r.location}, Sensor: ${r.sensor_type}, Confidence: ${r.confidence_level}%, Temp: ${r.temperature}°F. Provide updated severity, actions, and analysis.`);
    await req.app.locals.pool.query('UPDATE fire_detections SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
