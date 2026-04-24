const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM crew_deployments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM crew_deployments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level } = req.body;
  try {
    const aiResponse = await queryAI(`Optimize crew deployment:
Crew: ${crew_name}, Size: ${crew_size}, Specialization: ${specialization}, Incident: ${assigned_incident}, Location: ${deployment_location}, Shift: ${shift_start}-${shift_end}, Fatigue: ${fatigue_level}.
Provide: deployment optimization, rotation schedule recommendation, safety risk assessment based on fatigue, task prioritization, and crew effectiveness forecast.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO crew_deployments (crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Deployed',$10) RETURNING *`,
      [crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE crew_deployments SET crew_name=$1,crew_size=$2,specialization=$3,assigned_incident=$4,deployment_location=$5,shift_start=$6,shift_end=$7,fatigue_level=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [crew_name, crew_size, specialization, assigned_incident, deployment_location, shift_start, shift_end, fatigue_level, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM crew_deployments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM crew_deployments WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-evaluate deployment for ${r.crew_name} (${r.crew_size} members, ${r.specialization}), assigned to ${r.assigned_incident}. Fatigue: ${r.fatigue_level}. Provide updated rotation and safety recommendations.`);
    await req.app.locals.pool.query('UPDATE crew_deployments SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
