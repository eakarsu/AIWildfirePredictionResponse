const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM evacuation_plans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM evacuation_plans WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated } = req.body;
  try {
    const aiResponse = await queryAI(`Create a detailed evacuation plan for:
Zone: ${zone_name}, Population: ${population}, Primary Route: ${primary_route}, Secondary Route: ${secondary_route}, Assembly Point: ${assembly_point}, Special Needs: ${special_needs_count}, Vehicles: ${vehicles_estimated}.
Provide: estimated evacuation time, phase-by-phase plan, traffic management strategy, special needs accommodation, and contingency plans.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO evacuation_plans (zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Draft',$9) RETURNING *`,
      [zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE evacuation_plans SET zone_name=$1,population=$2,primary_route=$3,secondary_route=$4,assembly_point=$5,special_needs_count=$6,vehicles_estimated=$7,status=$8,updated_at=NOW() WHERE id=$9 RETURNING *`,
      [zone_name, population, primary_route, secondary_route, assembly_point, special_needs_count, vehicles_estimated, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM evacuation_plans WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM evacuation_plans WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Optimize evacuation plan for zone ${r.zone_name} with population ${r.population}. Routes: ${r.primary_route}, ${r.secondary_route}. Assembly: ${r.assembly_point}. Provide optimized timing, bottleneck analysis, and improvements.`);
    await req.app.locals.pool.query('UPDATE evacuation_plans SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
