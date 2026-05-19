import React, { useEffect, useState } from 'react';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import FireSpreadMap from '../components/FireSpreadMap';
import EvacuationMap from '../components/EvacuationMap';
import EvacuationBroadcast from '../components/EvacuationBroadcast';
import IncidentCommandWizard from '../components/IncidentCommandWizard';

const API = process.env.REACT_APP_API_URL || `http://localhost:${process.env.REACT_APP_BACKEND_PORT || 3011}/api`;

export default function CustomViewsPage() {
  const [tab, setTab] = useState('fire-spread');
  const [fire, setFire] = useState(null);
  const [evac, setEvac] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    axios.get(`${API}/custom-views/fire-spread-map`, { headers })
      .then(r => setFire(r.data))
      .catch(e => setErr(e.message));

    axios.get(`${API}/custom-views/evacuation-map`, { headers })
      .then(r => setEvac(r.data))
      .catch(e => setErr(e.message));
  }, []);

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 16px',
        marginRight: 6,
        border: '1px solid #555',
        borderRadius: 6,
        cursor: 'pointer',
        background: tab === id ? '#d32f2f' : '#222',
        color: '#fff',
        fontWeight: tab === id ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Emergency Maps</h1>
      <p style={{ color: '#bbb', marginTop: 4 }}>
        Bespoke geospatial views for wildfire prediction and evacuation response across
        California fire-prone regions.
      </p>

      <div style={{ margin: '16px 0' }}>
        {tabBtn('fire-spread', 'Fire Spread Map')}
        {tabBtn('evacuation', 'Evacuation Route Map')}
        {tabBtn('broadcast', 'Evacuation Broadcast')}
        {tabBtn('incident', 'Incident Command Wizard')}
      </div>

      {err && <div style={{ color: '#ff5252', marginBottom: 12 }}>Error: {err}</div>}

      {tab === 'fire-spread' && <FireSpreadMap data={fire} />}
      {tab === 'evacuation' && <EvacuationMap data={evac} />}
      {tab === 'broadcast' && <EvacuationBroadcast />}
      {tab === 'incident' && <IncidentCommandWizard />}
    </div>
  );
}
