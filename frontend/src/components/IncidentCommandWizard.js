import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL ||
  `http://localhost:${process.env.REACT_APP_BACKEND_PORT || 3011}/api`;

const card = {
  background: '#1c1c1c',
  border: '1px solid #333',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};

const inputStyle = {
  width: '100%',
  padding: 8,
  background: '#111',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: 6,
  fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block',
  fontWeight: 600,
  marginTop: 12,
  marginBottom: 6,
};

export default function IncidentCommandWizard() {
  const [step, setStep] = useState(1);
  const [meta, setMeta] = useState({
    incident_types: [],
    severity_levels: [],
    resource_catalog: [],
    recent_incidents: [],
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Step 1 fields
  const [incidentName, setIncidentName] = useState('');
  const [incidentType, setIncidentType] = useState('Wildfire');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState('Moderate');
  const [commander, setCommander] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 fields: { [resourceName]: count }
  const [resources, setResources] = useState({});

  function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadMeta() {
    try {
      const r = await axios.get(`${API}/custom-views/incident-command`, {
        headers: authHeaders(),
      });
      setMeta(r.data);
      if (r.data.incident_types?.length && !r.data.incident_types.includes(incidentType)) {
        setIncidentType(r.data.incident_types[0]);
      }
      if (r.data.severity_levels?.length && !r.data.severity_levels.includes(severity)) {
        setSeverity(r.data.severity_levels[0]);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { loadMeta(); /* eslint-disable-next-line */ }, []);

  function validateStep1() {
    if (!incidentName.trim()) return 'Incident name is required';
    if (!incidentType.trim()) return 'Incident type is required';
    if (!location.trim()) return 'Location is required';
    if (!severity.trim()) return 'Severity is required';
    if (!commander.trim()) return 'Commander name is required';
    return null;
  }

  function validateStep2() {
    const total = Object.values(resources).reduce(
      (s, v) => s + (parseInt(v, 10) || 0),
      0
    );
    if (total <= 0) return 'Request at least one resource';
    return null;
  }

  function next() {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) return setError(err);
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) return setError(err);
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setError(null);
    const e1 = validateStep1();
    if (e1) { setStep(1); return setError(e1); }
    const e2 = validateStep2();
    if (e2) { setStep(2); return setError(e2); }

    const cleanResources = {};
    Object.entries(resources).forEach(([k, v]) => {
      const n = parseInt(v, 10);
      if (n > 0) cleanResources[k] = n;
    });

    try {
      setSubmitting(true);
      const r = await axios.post(
        `${API}/custom-views/incident-command`,
        {
          incident_name: incidentName,
          incident_type: incidentType,
          location,
          severity,
          commander,
          resources: cleanResources,
          notes,
        },
        { headers: authHeaders() }
      );
      setResult(r.data);
      await loadMeta();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setIncidentName('');
    setLocation('');
    setCommander('');
    setNotes('');
    setResources({});
    setResult(null);
    setError(null);
  }

  const stepHeader = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            padding: 8,
            textAlign: 'center',
            background: step === s ? '#d32f2f' : step > s ? '#2e7d32' : '#333',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Step {s}: {s === 1 ? 'Details' : s === 2 ? 'Resources' : 'Review & Submit'}
        </div>
      ))}
    </div>
  );

  return (
    <div data-testid="incident-command-wizard">
      <h2 style={{ marginTop: 0 }}>Incident Command Form Wizard</h2>
      <p style={{ color: '#bbb', marginTop: 0 }}>
        Stand up incident command for a new event in three guided steps.
      </p>

      <div style={card}>
        {stepHeader}

        {step === 1 && (
          <div>
            <label style={labelStyle}>Incident Name *</label>
            <input
              style={inputStyle}
              value={incidentName}
              onChange={(e) => setIncidentName(e.target.value)}
              placeholder="e.g. Paradise Ridge Fire"
            />

            <label style={labelStyle}>Incident Type *</label>
            <select
              style={inputStyle}
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
            >
              {meta.incident_types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <label style={labelStyle}>Location *</label>
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Butte County, CA"
            />

            <label style={labelStyle}>Severity *</label>
            <select
              style={inputStyle}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {meta.severity_levels.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label style={labelStyle}>Incident Commander *</label>
            <input
              style={inputStyle}
              value={commander}
              onChange={(e) => setCommander(e.target.value)}
              placeholder="Full name"
            />

            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ color: '#bbb', marginBottom: 8 }}>
              Specify the number of each resource type being requested.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
              {meta.resource_catalog.map((r) => (
                <div key={r} style={{ background: '#222', border: '1px solid #444', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{r}</div>
                  <input
                    type="number"
                    min={0}
                    value={resources[r] || ''}
                    onChange={(e) =>
                      setResources({ ...resources, [r]: e.target.value })
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ marginTop: 0 }}>Review</h3>
            <div style={{ background: '#222', padding: 12, borderRadius: 6, marginBottom: 12 }}>
              <div><strong>Incident:</strong> {incidentName}</div>
              <div><strong>Type:</strong> {incidentType}</div>
              <div><strong>Location:</strong> {location}</div>
              <div><strong>Severity:</strong> {severity}</div>
              <div><strong>Commander:</strong> {commander}</div>
              {notes && <div><strong>Notes:</strong> {notes}</div>}
            </div>
            <div style={{ background: '#222', padding: 12, borderRadius: 6 }}>
              <strong>Resources requested:</strong>
              <ul style={{ marginTop: 6 }}>
                {Object.entries(resources)
                  .filter(([, v]) => parseInt(v, 10) > 0)
                  .map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
              </ul>
            </div>
            {result && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: '#0d2818',
                  border: '1px solid #2e7d32',
                  borderRadius: 6,
                  color: '#a5d6a7',
                }}
              >
                Incident #{result.incident_id} submitted — status: {result.status}.
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ color: '#ff5252', marginTop: 12 }}>Error: {error}</div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button
              onClick={prev}
              style={{
                padding: '8px 14px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              onClick={next}
              style={{
                padding: '8px 14px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Next
            </button>
          )}
          {step === 3 && !result && (
            <button
              onClick={submit}
              disabled={submitting}
              style={{
                padding: '8px 14px',
                background: '#d32f2f',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Incident'}
            </button>
          )}
          {step === 3 && result && (
            <button
              onClick={resetWizard}
              style={{
                padding: '8px 14px',
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Start New
            </button>
          )}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Recent Incidents</h3>
        {meta.recent_incidents.length === 0 && (
          <div style={{ color: '#888' }}>No incidents recorded yet.</div>
        )}
        {meta.recent_incidents.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
                <th style={{ padding: 6 }}>#</th>
                <th style={{ padding: 6 }}>Incident</th>
                <th style={{ padding: 6 }}>Type</th>
                <th style={{ padding: 6 }}>Severity</th>
                <th style={{ padding: 6 }}>Commander</th>
                <th style={{ padding: 6 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {meta.recent_incidents.map((i) => (
                <tr key={i.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: 6 }}>{i.id}</td>
                  <td style={{ padding: 6 }}>{i.incident_name}</td>
                  <td style={{ padding: 6 }}>{i.incident_type}</td>
                  <td style={{ padding: 6 }}>{i.severity}</td>
                  <td style={{ padding: 6 }}>{i.commander}</td>
                  <td style={{ padding: 6, fontSize: 12 }}>
                    {new Date(i.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
