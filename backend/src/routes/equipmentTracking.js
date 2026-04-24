const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM equipment_tracking ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM equipment_tracking WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to } = req.body;
  try {
    const aiResponse = await queryAI(`Assess firefighting equipment status:
Equipment: ${equipment_name}, Type: ${equipment_type}, Serial: ${serial_number}, Location: ${current_location}, Condition: ${condition}, Last Maintenance: ${last_maintenance}, Hours Used: ${hours_used}, Assigned To: ${assigned_to}.
Provide: maintenance prediction, reliability score, replacement timeline, optimal deployment scenario, and safety compliance status.`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO equipment_tracking (equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Operational',$10) RETURNING *`,
      [equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE equipment_tracking SET equipment_name=$1,equipment_type=$2,serial_number=$3,current_location=$4,condition=$5,last_maintenance=$6,hours_used=$7,assigned_to=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [equipment_name, equipment_type, serial_number, current_location, condition, last_maintenance, hours_used, assigned_to, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM equipment_tracking WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM equipment_tracking WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Re-assess equipment ${r.equipment_name} (${r.equipment_type}): Condition ${r.condition}, ${r.hours_used} hours used, last maintained ${r.last_maintenance}. Provide updated maintenance schedule and reliability forecast.`);
    await req.app.locals.pool.query('UPDATE equipment_tracking SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
