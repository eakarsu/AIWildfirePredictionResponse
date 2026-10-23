import React, { useMemo, useState } from 'react';

// Labelled sections preserve false / 0 / empty values instead of hiding them.
export function formatValue(value) {
  if (value === false) return 'false';
  if (value === 0) return '0';
  if (value === '') return '(empty)';
  if (value == null) return '(empty)';
  return String(value);
}

export default function FeaturePackPanel({ tasks = [], aiResults = [] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const filtered = useMemo(() => tasks.filter((t) => {
    if (status && String(t.status) !== status) return false;
    if (!q) return true;
    return [t.title, t.description, t.status, t.priority, t.assignee].join(' ').toLowerCase().includes(q.toLowerCase());
  }), [tasks, q, status]);
  const exportJSON = () => JSON.stringify({ tasks: filtered }, null, 2);
  return (
    <section aria-label="Feature pack">
      <h2>Tasks</h2>
      <label>Search <input aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <label>Status filter <input aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)} /></label>
      <h3>Task list ({formatValue(filtered.length)})</h3>
      {filtered.length === 0 ? <p>(empty)</p> : filtered.map((t) => (
        <article key={t.id}>
          <div>Title: {formatValue(t.title)}</div>
          <div>Status: {formatValue(t.status)}</div>
          <div>Priority: {formatValue(t.priority)}</div>
          <div>Completed: {formatValue(Boolean(t.completed))}</div>
          <div>Estimated hours: {formatValue(Number(t.estimatedHours) || 0)}</div>
          <div>Assignee: {formatValue(t.assignee || '')}</div>
        </article>
      ))}
      <h3>Export</h3>
      <pre aria-label="JSON export">{exportJSON()}</pre>
      <h3>AI insights (deterministic fallback)</h3>
      {aiResults.length === 0 ? <p>(empty)</p> : aiResults.map((r, i) => (
        <article key={i}>
          <div>Label: {formatValue(r.label || '')}</div>
          <div>aiGenerated: {formatValue(Boolean(r.aiGenerated))}</div>
          <div>Total: {formatValue(r.total ?? 0)}</div>
          <div>Open: {formatValue(r.openCount ?? 0)}</div>
          <div>Has open work: {formatValue(Boolean(r.hasOpenWork))}</div>
          <div>Note: {formatValue(r.note || '')}</div>
        </article>
      ))}
    </section>
  );
}
