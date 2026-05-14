import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const features = [
  { path: '/risk-assessments', icon: '🎯', label: 'Risk Assessments' },
  { path: '/fire-detections', icon: '🔥', label: 'Fire Detections' },
  { path: '/evacuation-plans', icon: '🚨', label: 'Evacuation Plans' },
  { path: '/resource-allocations', icon: '📦', label: 'Resource Allocations' },
  { path: '/weather-analyses', icon: '🌤️', label: 'Weather Analyses' },
  { path: '/smoke-reports', icon: '💨', label: 'Smoke Reports' },
  { path: '/community-alerts', icon: '📢', label: 'Community Alerts' },
  { path: '/damage-assessments', icon: '🏚️', label: 'Damage Assessments' },
  { path: '/spread-predictions', icon: '📈', label: 'Spread Predictions' },
  { path: '/water-sources', icon: '💧', label: 'Water Sources' },
  { path: '/crew-deployments', icon: '👷', label: 'Crew Deployments' },
  { path: '/equipment-tracking', icon: '🚒', label: 'Equipment Tracking' },
];

export default function Sidebar({ open, onToggle, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <button className="sidebar-toggle" onClick={onToggle}>
        {open ? '◀' : '▶'}
      </button>
      <aside className={`sidebar ${open ? '' : 'closed'}`}>
        <div className="sidebar-header" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo">🔥</div>
          <h1>AI Wildfire<br /><span>Prediction & Response</span></h1>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Dashboard</div>
          <button className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`} onClick={() => navigate('/')}>
            <span className="icon">📊</span> Overview
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">AI Center</div>
          <button className={`sidebar-link ${location.pathname === '/ai-center' ? 'active' : ''}`} onClick={() => navigate('/ai-center')}>
            <span className="icon">🧠</span> AI Command Center
          </button>
          <button className={`sidebar-link ${location.pathname === '/ai-tools' ? 'active' : ''}`} onClick={() => navigate('/ai-tools')}>
            <span className="icon">🛠️</span> AI Field Tools
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">Features</div>
          {features.map(f => (
            <button
              key={f.path}
              className={`sidebar-link ${location.pathname === f.path ? 'active' : ''}`}
              onClick={() => navigate(f.path)}
            >
              <span className="icon">{f.icon}</span> {f.label}
            </button>
          ))}
        </div>

        <div className="sidebar-user">
          <div className="avatar">{user.name?.[0] || 'U'}</div>
          <div className="info">
            <div className="name">{user.name}</div>
            <div className="role">{user.role}</div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </aside>
    </>
  );
}
