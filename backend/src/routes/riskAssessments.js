const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM risk_assessments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM risk_assessments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { location, latitude, longitude, vegetation_type, terrain, weather_conditions } = req.body;
  try {
    const aiPrompt = `Analyze wildfire risk for the following area and provide a detailed risk assessment with risk level (Critical/High/Medium/Low), risk score (0-100), key risk factors, and recommended actions:
Location: ${location}
Coordinates: ${latitude}, ${longitude}
Vegetation: ${vegetation_type}
Terrain: ${terrain}
Weather: ${weather_conditions}

Respond with a structured analysis including: risk_level, risk_score, risk_factors (array), recommendations (array), and detailed_analysis.`;

    const aiResponse = await queryAI(aiPrompt);
    const result = await req.app.locals.pool.query(
      `INSERT INTO risk_assessments (location, latitude, longitude, vegetation_type, terrain, weather_conditions, ai_analysis, risk_level, risk_score, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [location, latitude, longitude, vegetation_type, terrain, weather_conditions, aiResponse, req.body.risk_level || 'Pending', req.body.risk_score || 0, req.user.id]
    );
    res.json(result.rows[0]);
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

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM risk_assessments WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Provide an updated wildfire risk assessment for: Location: ${r.location}, Vegetation: ${r.vegetation_type}, Terrain: ${r.terrain}, Weather: ${r.weather_conditions}. Include risk level, score, factors, and actionable recommendations.`);
    await req.app.locals.pool.query('UPDATE risk_assessments SET ai_analysis=$1, updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
