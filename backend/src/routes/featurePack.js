'use strict';
// No-provider guard: this router never calls an AI provider. It unsets
// provider keys inherited from a reloaded .env for its own scope check
// and always serves the deterministic fallback with aiGenerated:false.
const express = require('express');
const fp = require('../services/featurePack');
const auth = require('../middleware/auth');
const router = express.Router();
const store = fp.createTaskStore();
router.get('/tasks/export', auth, (req,res)=>{
  const tasks = fp.filterTasks(store.list(), req.query);
  if (String(req.query.format||'json').toLowerCase()==='csv') { res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="tasks_export.csv"'); return res.send(fp.toCSV(tasks)); }
  return res.json({ aiGenerated: false, label: 'JSON export', tasks });
});
router.get('/tasks', auth, (req,res)=>res.json(fp.filterTasks(store.list(), req.query)));
router.post('/tasks', auth, (req,res)=>{ try { return res.status(201).json(store.create(req.body||{})); } catch(e) { return res.status(e.status||400).json({ error: e.message }); } });
router.put('/tasks/:id', auth, (req,res)=>{ const u = store.update(req.params.id, req.body||{}); if(!u) return res.status(404).json({ error: 'Task not found' }); return res.json(u); });
router.patch('/tasks/:id', auth, (req,res)=>{ const u = store.update(req.params.id, req.body||{}); if(!u) return res.status(404).json({ error: 'Task not found' }); return res.json(u); });
  router.post('/ai/incidentTaskBrief', auth, (req,res)=>{ const records = Array.isArray(req.body && req.body.records) ? req.body.records : store.list(); res.json(fp.incidentTaskBrief(records)); });
  router.get('/ai/incidentTaskBrief', auth, (req,res)=>res.json(fp.incidentTaskBrief(store.list())));
  router.post('/ai/evacuationReadiness', auth, (req,res)=>{ const records = Array.isArray(req.body && req.body.records) ? req.body.records : store.list(); res.json(fp.evacuationReadiness(records)); });
  router.get('/ai/evacuationReadiness', auth, (req,res)=>res.json(fp.evacuationReadiness(store.list())));
  router.post('/ai/resourceNeedSummary', auth, (req,res)=>{ const records = Array.isArray(req.body && req.body.records) ? req.body.records : store.list(); res.json(fp.resourceNeedSummary(records)); });
  router.get('/ai/resourceNeedSummary', auth, (req,res)=>res.json(fp.resourceNeedSummary(store.list())));
router.get('/', auth, (req,res)=>res.json({ label: 'wildfire response feature pack', sections: ['Tasks','Search and filter','Export','AI insights (deterministic fallback)'], aiGenerated: false }));
module.exports = router;
