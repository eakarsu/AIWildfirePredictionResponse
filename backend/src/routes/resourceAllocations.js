const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM resource_allocations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM resource_allocations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { incident_name, resource_type, quantity, location, priority, estimated_cost } = req.body;
  try {
    const aiResponse = await queryAI(`Optimize resource allocation for wildfire incident:
Incident: ${incident_name}, Resource Type: ${resource_type}, Quantity: ${quantity}, Location: ${location}, Priority: ${priority}, Est. Cost: $${estimated_cost}.
Provide: optimal deployment strategy, resource sufficiency analysis, cost-effectiveness rating, alternative resource options, and timeline.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO resource_allocations (incident_name, resource_type, quantity, location, priority, estimated_cost, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8) RETURNING *`,
      [incident_name, resource_type, quantity, location, priority, estimated_cost, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { incident_name, resource_type, quantity, location, priority, estimated_cost, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE resource_allocations SET incident_name=$1,resource_type=$2,quantity=$3,location=$4,priority=$5,estimated_cost=$6,status=$7,updated_at=NOW() WHERE id=$8 RETURNING *`,
      [incident_name, resource_type, quantity, location, priority, estimated_cost, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM resource_allocations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM resource_allocations WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-evaluate resource allocation: ${r.resource_type} x${r.quantity} for ${r.incident_name} at ${r.location}. Priority: ${r.priority}. Provide optimization suggestions and efficiency analysis.`);
    await req.app.locals.pool.query('UPDATE resource_allocations SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
