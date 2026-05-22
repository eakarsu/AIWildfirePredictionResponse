import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL ||
  `http://localhost:${process.env.REACT_APP_BACKEND_PORT || 3011}/api`;

const CHANNELS = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'Email' },
  { id: 'loudspeaker', label: 'Loudspeaker' },
];

export default function EvacuationBroadcast() {
  const [zones, setZones] = useState([]);
  const [recent, setRecent] = useState([]);
  const [selectedZones, setSelectedZones] = useState([]);
  const [message, setMessage] = useState('Mandatory evacuation in effect. Proceed to nearest designated shelter immediately.');
  const [selectedChannels, setSelectedChannels] = useState(['sms', 'email']);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function load() {
    try {
      const r = await axios.get(`${API}/custom-views/evacuation-broadcast`, {
        headers: authHeaders(),
      });
      setZones(r.data.zones || []);
      setRecent(r.data.recent_orders || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleZone(id) {
    setSelectedZones((prev) =>
      prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]
    );
  }

  function toggleChannel(id) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function issueOrder() {
    setError(null);
    setResult(null);
    if (selectedZones.length === 0) {
      setError('Select at least one zone');
      return;
    }
    if (!message.trim()) {
      setError('Message is required');
      return;
    }
    if (selectedChannels.length === 0) {
      setError('Select at least one channel');
      return;
    }
    try {
      setSubmitting(true);
      const r = await axios.post(
        `${API}/custom-views/evacuation-broadcast`,
        { zones: selectedZones, message, channels: selectedChannels },
        { headers: authHeaders() }
      );
      setResult(r.data);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const card = {
    background: '#1c1c1c',
    border: '1px solid #333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  };

  return (
    <div data-testid="evacuation-broadcast">
      <h2 style={{ marginTop: 0 }}>Evacuation Order Broadcast</h2>
      <p style={{ color: '#bbb', marginTop: 0 }}>
        Issue an evacuation order to selected zones across multiple alert channels.
      </p>

      <div style={card}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
          Zones (multi-select)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {zones.map((z) => {
            const selected = selectedZones.includes(z.id);
            return (
              <label
                key={z.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 8,
                  border: '1px solid #444',
                  borderRadius: 6,
                  background: selected ? '#3a1a1a' : '#222',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleZone(z.id)}
                  style={{ marginRight: 8 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{z.zone_name}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>
                    Pop ~{z.population_estimate}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <label style={{ display: 'block', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: 8,
            background: '#111',
            color: '#eee',
            border: '1px solid #444',
            borderRadius: 6,
            fontFamily: 'inherit',
          }}
        />

        <label style={{ display: 'block', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
          Channels
        </label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {CHANNELS.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selectedChannels.includes(c.id)}
                onChange={() => toggleChannel(c.id)}
                style={{ marginRight: 6 }}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={issueOrder}
            disabled={submitting}
            style={{
              padding: '10px 18px',
              background: '#d32f2f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting ? 'Issuing...' : 'Issue Order'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#ff5252', marginTop: 12 }}>Error: {error}</div>
        )}
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
            Order #{result.order_id} issued via {result.channels_used.join(', ')} —
            estimated {result.est_recipients.toLocaleString()} recipients.
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Recent Orders</h3>
        {recent.length === 0 && (
          <div style={{ color: '#888' }}>No orders issued yet.</div>
        )}
        {recent.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
                <th style={{ padding: 6 }}>#</th>
                <th style={{ padding: 6 }}>When</th>
                <th style={{ padding: 6 }}>Zones</th>
                <th style={{ padding: 6 }}>Channels</th>
                <th style={{ padding: 6 }}>Recipients</th>
                <th style={{ padding: 6 }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: 6 }}>{o.id}</td>
                  <td style={{ padding: 6, fontSize: 12 }}>
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: 6, fontSize: 12 }}>
                    {(o.zones || []).join(', ')}
                  </td>
                  <td style={{ padding: 6, fontSize: 12 }}>
                    {(o.channels || []).join(', ')}
                  </td>
                  <td style={{ padding: 6 }}>
                    {Number(o.est_recipients).toLocaleString()}
                  </td>
                  <td style={{ padding: 6, fontSize: 12, maxWidth: 280 }}>
                    {o.message}
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
