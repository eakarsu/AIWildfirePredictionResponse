const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM water_sources ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM water_sources WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible } = req.body;
  try {
    const aiResponse = await queryAI(`Evaluate water source for firefighting:
Name: ${name}, Type: ${source_type}, Location: (${latitude}, ${longitude}), Capacity: ${capacity_gallons} gallons, Accessibility: ${accessibility}, Road Access: ${road_access}, Helicopter: ${helicopter_accessible}.
Provide: tactical assessment, optimal use scenarios, seasonal reliability, pump/hose requirements, and coverage radius for firefighting operations.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO water_sources (name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Available',$10) RETURNING *`,
      [name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE water_sources SET name=$1,source_type=$2,latitude=$3,longitude=$4,capacity_gallons=$5,accessibility=$6,road_access=$7,helicopter_accessible=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [name, source_type, latitude, longitude, capacity_gallons, accessibility, road_access, helicopter_accessible, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM water_sources WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM water_sources WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-evaluate water source ${r.name}: ${r.source_type}, ${r.capacity_gallons} gallons, ${r.accessibility} access. Provide updated tactical value and seasonal assessment.`);
    await req.app.locals.pool.query('UPDATE water_sources SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
