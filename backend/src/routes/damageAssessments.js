const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM damage_assessments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM damage_assessments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities } = req.body;
  try {
    const aiResponse = await queryAI(`Assess wildfire damage:
Incident: ${incident_name}, Location: ${location}, Acres: ${acres_burned}, Structures Damaged: ${structures_damaged}, Destroyed: ${structures_destroyed}, Cost: $${estimated_cost}, Injuries: ${injuries}, Fatalities: ${fatalities}.
Provide: damage severity classification, recovery timeline estimate, environmental impact assessment, infrastructure restoration priorities, and federal aid eligibility analysis.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO damage_assessments (incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'In Progress',$10) RETURNING *`,
      [incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE damage_assessments SET incident_name=$1,location=$2,acres_burned=$3,structures_damaged=$4,structures_destroyed=$5,estimated_cost=$6,injuries=$7,fatalities=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [incident_name, location, acres_burned, structures_damaged, structures_destroyed, estimated_cost, injuries, fatalities, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM damage_assessments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM damage_assessments WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Update damage assessment for ${r.incident_name}: ${r.acres_burned} acres, ${r.structures_destroyed} structures destroyed, $${r.estimated_cost} cost. Provide updated recovery plan and aid recommendations.`);
    await req.app.locals.pool.query('UPDATE damage_assessments SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
