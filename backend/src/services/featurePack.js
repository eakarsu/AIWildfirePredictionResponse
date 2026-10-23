'use strict';
// Deterministic feature-pack logic. Never calls an AI provider: when no
// provider is configured the endpoints return labelled fallback results
// with aiGenerated:false. Provider keys are only inspected, never used
// to make a network call from this module.
const FALLBACK_LABEL = 'Deterministic fallback (no AI provider called)';

function hasProviderConfigured(env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY);
}

function normalizeTask(input = {}, id) {
  return {
    id: String(id),
    title: String(input.title || '').trim(),
    description: input.description == null ? '' : String(input.description),
    status: input.status ? String(input.status) : 'open',
    priority: input.priority ? String(input.priority) : 'medium',
    assignee: input.assignee == null ? '' : String(input.assignee),
    dueDate: input.dueDate == null ? '' : String(input.dueDate),
    estimatedHours: Number(input.estimatedHours) || 0,
    completed: Boolean(input.completed),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTaskStore(seed = []) {
  let seq = 0;
  const tasks = seed.map((t) => normalizeTask(t, ++seq));
  return {
    list() { return tasks.map((t) => ({ ...t })); },
    create(input) {
      if (!input || !String(input.title || '').trim()) { const e = new Error('title is required'); e.status = 400; throw e; }
      const task = normalizeTask(input, ++seq);
      tasks.push(task);
      return { ...task };
    },
    update(id, patch = {}) {
      const idx = tasks.findIndex((t) => t.id === String(id));
      if (idx === -1) return null;
      const merged = { ...tasks[idx], ...patch, id: tasks[idx].id, createdAt: tasks[idx].createdAt };
      tasks[idx] = normalizeTask(merged, tasks[idx].id);
      return { ...tasks[idx] };
    },
  };
}

function filterTasks(tasks, { q = '', status = '', priority = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return tasks.filter((t) => {
    if (status && String(t.status) !== status) return false;
    if (priority && String(t.priority) !== priority) return false;
    if (!needle) return true;
    return [t.title, t.description, t.status, t.priority, t.assignee].join(' ').toLowerCase().includes(needle);
  });
}

function toCSV(tasks) {
  const headers = ['id','title','description','status','priority','assignee','dueDate','estimatedHours','completed'];
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return [headers.join(','), ...tasks.map((t) => headers.map((h) => esc(t[h])).join(','))].join('\n');
}

function taskStats(records) {
  const list = Array.isArray(records) ? records : [];
  const open = list.filter((t) => !t.completed && String(t.status) !== 'done' && String(t.status) !== 'completed').length;
  const high = list.filter((t) => String(t.priority) === 'high' || String(t.priority) === 'critical').length;
  const totalHours = list.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
  return {
    total: list.length,
    openCount: open,
    highPriorityCount: high,
    completedCount: list.length - open,
    completionRate: list.length ? Math.round(((list.length - open) / list.length) * 100) : 0,
    totalEstimatedHours: totalHours,
    hasOpenWork: open > 0,
    note: '',
  };
}

function fallback(feature, records) {
  return { aiGenerated: false, label: FALLBACK_LABEL, feature, providerConfigured: hasProviderConfigured(), ...taskStats(records) };
}
function incidentTaskBrief(records) { return fallback('incidentTaskBrief', records); }
function evacuationReadiness(records) { return fallback('evacuationReadiness', records); }
function resourceNeedSummary(records) { return fallback('resourceNeedSummary', records); }
module.exports = { FALLBACK_LABEL, hasProviderConfigured, normalizeTask, createTaskStore, filterTasks, toCSV, taskStats, incidentTaskBrief, evacuationReadiness, resourceNeedSummary };
