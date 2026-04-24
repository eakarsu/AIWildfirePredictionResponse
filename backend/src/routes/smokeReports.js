const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM smoke_reports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM smoke_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description } = req.body;
  try {
    const aiResponse = await queryAI(`Analyze smoke report:
Location: ${location} (${latitude}, ${longitude}), Color: ${smoke_color}, Density: ${smoke_density}, Wind: ${wind_direction}, Description: ${description}.
Provide: likely fire type based on smoke color, estimated distance, air quality impact assessment, recommended response level, and public health advisory.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO smoke_reports (location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Reported',$10) RETURNING *`,
      [location, latitude, longitude, smoke_color, smoke_density, wind_direction, reporter_name, description, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
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

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM smoke_reports WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-analyze smoke report at ${r.location}: Color: ${r.smoke_color}, Density: ${r.smoke_density}, Wind: ${r.wind_direction}. ${r.description}. Provide updated assessment.`);
    await req.app.locals.pool.query('UPDATE smoke_reports SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
