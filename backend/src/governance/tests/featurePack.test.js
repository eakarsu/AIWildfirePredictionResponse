'use strict';
// Offline only: unset provider keys before importing app modules.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
const test = require('node:test');
const assert = require('node:assert/strict');
const fp = require('../../services/featurePack');

test('tasks create/list/search/update', () => {
  const store = fp.createTaskStore();
  const a = store.create({ title: 'Alpha task', priority: 'high', status: 'open' });
  store.create({ title: 'Beta task', priority: 'low', status: 'done', completed: true });
  assert.equal(store.list().length, 2);
  assert.equal(fp.filterTasks(store.list(), { q: 'alpha' }).length, 1);
  assert.equal(fp.filterTasks(store.list(), { status: 'done' }).length, 1);
  const updated = store.update(a.id, { status: 'done', completed: true });
  assert.equal(updated.status, 'done');
  assert.equal(store.update('missing', { status: 'x' }), null);
  assert.throws(() => store.create({ title: '' }), /title is required/);
});

test('export CSV/JSON preserves headers and values', () => {
  const rows = [{ id: '1', title: 'A', description: '', status: 'open', priority: 'high', assignee: '', dueDate: '', estimatedHours: 0, completed: false }];
  const csv = fp.toCSV(rows);
  assert.ok(csv.startsWith('id,title'));
  assert.ok(csv.includes('"false"') || csv.includes('false'));
  assert.equal(JSON.parse(JSON.stringify(rows))[0].estimatedHours, 0);
});

test('domain AI fallbacks are labelled deterministic and preserve 0/false/empty', () => {
  const fns = [fp.incidentTaskBrief, fp.evacuationReadiness, fp.resourceNeedSummary];
  for (const fn of fns) {
    const out = fn([]);
    assert.equal(out.aiGenerated, false);
    assert.ok(out.label.includes('Deterministic fallback'));
    assert.equal(out.total, 0);
    assert.equal(out.hasOpenWork, false);
    assert.equal(out.note, '');
  }
});

test('router requires auth and serves fallback offline', async () => {
  delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-at-least-32-characters-long!!';
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const router = require('../../routes/featurePack');
  const app = express(); app.use(express.json()); app.use('/api/feature-pack', router);
  const server = app.listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const unauth = await fetch(base + '/api/feature-pack/tasks');
    assert.equal(unauth.status, 401);
    const token = jwt.sign({ id: 1, tenantId: 't1', role: 'operator', subjectIds: [1] }, process.env.JWT_SECRET);
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const created = await fetch(base + '/api/feature-pack/tasks', { method: 'POST', headers, body: JSON.stringify({ title: 'Offline task', priority: 'high' }) });
    assert.equal(created.status, 201);
    const list = await (await fetch(base + '/api/feature-pack/tasks?q=Offline', { headers })).json();
    assert.equal(list.length, 1);
    const csvRes = await fetch(base + '/api/feature-pack/tasks/export?format=csv', { headers });
    assert.match(csvRes.headers.get('content-type') || '', /text\/csv/);
    assert.ok((await csvRes.text()).includes('Offline task'));
    const ai0 = await (await fetch(base + '/api/feature-pack/ai/incidentTaskBrief', { method:'POST', headers, body: JSON.stringify({records:[]}) })).json(); assert.equal(ai0.aiGenerated, false);
    const ai1 = await (await fetch(base + '/api/feature-pack/ai/evacuationReadiness', { method:'POST', headers, body: JSON.stringify({records:[]}) })).json(); assert.equal(ai1.aiGenerated, false);
    const ai2 = await (await fetch(base + '/api/feature-pack/ai/resourceNeedSummary', { method:'POST', headers, body: JSON.stringify({records:[]}) })).json(); assert.equal(ai2.aiGenerated, false);
  } finally { server.close(); }
});
