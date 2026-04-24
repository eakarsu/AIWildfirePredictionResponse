const router = require('express').Router();
const auth = require('../middleware/auth');
const { queryAI } = require('../services/openrouter');

router.get('/', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM community_alerts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await req.app.locals.pool.query('SELECT * FROM community_alerts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  const { title, alert_type, severity, affected_area, population_affected, message } = req.body;
  try {
    const aiResponse = await queryAI(`Generate a professional community wildfire alert:
Title: ${title}, Type: ${alert_type}, Severity: ${severity}, Area: ${affected_area}, Population: ${population_affected}, Initial Message: ${message}.
Provide: refined alert message suitable for public broadcast, safety instructions, evacuation guidance if needed, resource contact information, and multi-language summary (English/Spanish).`);
    const result = await req.app.locals.pool.query(
      `INSERT INTO community_alerts (title, alert_type, severity, affected_area, population_affected, message, ai_analysis, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Draft',$8) RETURNING *`,
      [title, alert_type, severity, affected_area, population_affected, message, aiResponse, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { title, alert_type, severity, affected_area, population_affected, message, status } = req.body;
  try {
    const result = await req.app.locals.pool.query(
      `UPDATE community_alerts SET title=$1,alert_type=$2,severity=$3,affected_area=$4,population_affected=$5,message=$6,status=$7,updated_at=NOW() WHERE id=$8 RETURNING *`,
      [title, alert_type, severity, affected_area, population_affected, message, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await req.app.locals.pool.query('DELETE FROM community_alerts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, async (req, res) => {
  try {
    const item = await req.app.locals.pool.query('SELECT * FROM community_alerts WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = item.rows[0];
    const aiResponse = await queryAI(`Improve community alert "${r.title}": Type: ${r.alert_type}, Severity: ${r.severity}, Area: ${r.affected_area}. Current message: ${r.message}. Make it clearer, more actionable, and include safety guidelines.`);
    await req.app.locals.pool.query('UPDATE community_alerts SET ai_analysis=$1,updated_at=NOW() WHERE id=$2', [aiResponse, req.params.id]);
    res.json({ ai_analysis: aiResponse });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
