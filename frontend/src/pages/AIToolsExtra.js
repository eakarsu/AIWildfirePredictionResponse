import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

// Wraps the five /api/ai/* endpoints (aiFeatures.js):
//   fire-spread-predictor, evacuation-route-optimizer, resource-allocation-planner,
//   post-fire-damage-assessor, weather-risk-monitor
// JWT is sent automatically (interceptor in api.js).
const TOOLS = [
  {
    key: 'fire-spread-predictor',
    title: 'Fire Spread Predictor',
    desc: 'Predict 6/12/24-hour wildfire spread from wind, terrain, and fuel inputs.',
    fields: [
      { key: 'fire_name', label: 'Fire Name', type: 'text', placeholder: 'e.g., Ridge Fire' },
      { key: 'current_acres', label: 'Current Size (acres)', type: 'number' },
      { key: 'wind_speed', label: 'Wind Speed (mph)', type: 'number' },
      { key: 'wind_direction', label: 'Wind Direction (deg)', type: 'number' },
      { key: 'terrain', label: 'Terrain', type: 'text', placeholder: 'e.g., Steep, mixed conifer slope' },
      { key: 'fuel_moisture', label: 'Fuel Moisture (%)', type: 'number' },
      { key: 'vegetation_type', label: 'Vegetation Type', type: 'text', placeholder: 'e.g., Chaparral' },
    ],
  },
  {
    key: 'evacuation-route-optimizer',
    title: 'Evacuation Route Optimizer',
    desc: 'Generate evacuation zones and routes for a fire location.',
    fields: [
      { key: 'fire_location', label: 'Fire Location', type: 'text', placeholder: 'e.g., 12 mi NE of Paradise, CA' },
      { key: 'fire_acres', label: 'Fire Size (acres)', type: 'number' },
      { key: 'wind_direction', label: 'Wind Direction', type: 'text', placeholder: 'e.g., NE 25 mph' },
      { key: 'zones', label: 'Zones to Evacuate', type: 'textarea' },
      { key: 'road_network_description', label: 'Road Network', type: 'textarea' },
    ],
  },
  {
    key: 'resource-allocation-planner',
    title: 'Resource Allocation Planner',
    desc: 'Plan firefighting resource deployment for an incident.',
    fields: [
      { key: 'incident_name', label: 'Incident Name', type: 'text' },
      { key: 'incident_size_acres', label: 'Incident Size (acres)', type: 'number' },
      { key: 'priority_level', label: 'Priority (1-5)', type: 'number' },
      { key: 'available_resources', label: 'Available Resources', type: 'textarea', placeholder: 'List crews, engines, helicopters, retardant...' },
      { key: 'terrain_access', label: 'Terrain / Access Notes', type: 'textarea' },
    ],
  },
  {
    key: 'post-fire-damage-assessor',
    title: 'Post-Fire Damage Assessor',
    desc: 'Estimate damages and recovery actions after containment.',
    fields: [
      { key: 'fire_name', label: 'Fire Name', type: 'text' },
      { key: 'final_acres', label: 'Final Size (acres)', type: 'number' },
      { key: 'affected_communities', label: 'Affected Communities', type: 'textarea' },
      { key: 'structures_in_zone', label: 'Structures in Zone', type: 'number' },
      { key: 'observations', label: 'Field Observations', type: 'textarea' },
    ],
  },
  {
    key: 'weather-risk-monitor',
    title: 'Weather Risk Monitor',
    desc: 'Convert a weather forecast into wildfire risk indicators.',
    fields: [
      { key: 'region', label: 'Region', type: 'text', placeholder: 'e.g., NorCal Foothills' },
      { key: 'forecast_period', label: 'Forecast Period', type: 'text', placeholder: 'e.g., Next 72 hours' },
      { key: 'temperature_f', label: 'Temperature (F)', type: 'number' },
      { key: 'humidity_pct', label: 'Humidity (%)', type: 'number' },
      { key: 'wind_forecast', label: 'Wind Forecast', type: 'textarea' },
      { key: 'precipitation_outlook', label: 'Precipitation Outlook', type: 'text' },
    ],
  },
  {
    key: 'resource-deployment-optimizer',
    title: 'Resource Deployment Optimizer',
    desc: 'Real-time deployment plan: where to send each crew/engine/aircraft right now.',
    fields: [
      { key: 'time_horizon_hours', label: 'Horizon (hours)', type: 'number' },
      { key: 'fires', label: 'Active Fires (JSON)', type: 'json', placeholder: '[{"id":"F1","name":"Ridge","acres":1200,"status":"active"}]' },
      { key: 'crews', label: 'Crews (JSON)', type: 'json', placeholder: '[{"id":"C1","type":"hotshot","members":20,"location":"Camp A"}]' },
      { key: 'engines', label: 'Engines / Dozers (JSON)', type: 'json', placeholder: '[{"id":"E1","type":"engine","staging":"Hwy 5"}]' },
      { key: 'aircraft', label: 'Aircraft (JSON)', type: 'json', placeholder: '[{"id":"H1","type":"helicopter","capacity_gal":1000}]' },
      { key: 'water_sources', label: 'Water Sources (JSON)', type: 'json', placeholder: '[{"id":"W1","type":"hydrant","gpm":1500}]' },
    ],
  },
  {
    key: 'community-alert-prioritization',
    title: 'Community Alert Prioritization',
    desc: 'Rank pending community alerts and zones by urgency.',
    fields: [
      { key: 'fires', label: 'Active Fires (JSON)', type: 'json', placeholder: '[{"id":"F1","name":"Ridge","acres":1200,"location":"NE of Paradise"}]' },
      { key: 'communities', label: 'Communities / Zones (JSON)', type: 'json', placeholder: '[{"id":"Z1","name":"Pine Heights","population":2400,"distance_mi":2.5}]' },
      { key: 'current_alerts', label: 'Existing Alerts (JSON)', type: 'json', placeholder: '[{"community_id":"Z1","level":"Watch"}]' },
      { key: 'weather', label: 'Weather (JSON)', type: 'json', placeholder: '{"wind_mph":25,"direction":"NE","humidity":15}' },
    ],
  },
];

function ToolCard({ tool }) {
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {};
      for (const f of tool.fields) {
        if (form[f.key] === undefined || form[f.key] === '') continue;
        if (f.type === 'number') payload[f.key] = Number(form[f.key]);
        else if (f.type === 'json') {
          try { payload[f.key] = JSON.parse(form[f.key]); }
          catch (jerr) { throw new Error(`Invalid JSON in "${f.label}": ${jerr.message}`); }
        }
        else payload[f.key] = form[f.key];
      }
      const { data } = await api.post(`/ai/${tool.key}`, payload);
      setResult(data);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || err.message;
      if (status === 503 || /unavailable|no api key|OPENROUTER/i.test(String(msg))) {
        setError('AI service unavailable. Set OPENROUTER_API_KEY on the backend, then retry.');
      } else {
        setError(String(msg));
      }
    }
    setLoading(false);
  };

  return (
    <div className="ai-tool-card" style={{ marginBottom: 16 }}>
      <h3>{tool.title}</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>{tool.desc}</p>
      {tool.fields.map(f => (
        <div key={f.key} className="form-group" style={{ marginBottom: 8 }}>
          <label>{f.label}</label>
          {f.type === 'textarea' ? (
            <textarea rows={3} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          ) : f.type === 'json' ? (
            <textarea rows={5} placeholder={f.placeholder || ''} style={{ fontFamily: 'monospace' }} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          ) : (
            <input type={f.type || 'text'} placeholder={f.placeholder || ''} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <button className="btn btn-ai btn-sm" onClick={submit} disabled={loading}>
        {loading ? 'Analyzing...' : 'Run AI'}
      </button>
      {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
      {result && (
        <div className="ai-analysis-container" style={{ marginTop: 16 }}>
          <div className="ai-analysis-header">
            <div className="ai-icon">🧠</div>
            <h4>Result</h4>
          </div>
          <div className="ai-analysis-body">
            {result.ai_raw ? (
              <ReactMarkdown>{result.ai_raw}</ReactMarkdown>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(result.result || result, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIToolsExtra() {
  return (
    <div>
      <div className="page-header"><h1>🛠️ AI Field Tools</h1></div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
        Specialized AI tools for fire behavior, evacuation, resources, damage and weather risk.
      </p>
      <div className="ai-center-grid">
        {TOOLS.map(t => <ToolCard key={t.key} tool={t} />)}
      </div>
    </div>
  );
}
