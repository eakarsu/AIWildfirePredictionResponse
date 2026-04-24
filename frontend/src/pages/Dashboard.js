import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const features = [
  { key: 'risk-assessments', icon: '🎯', title: 'Risk Assessments', desc: 'AI-powered wildfire risk prediction and assessment for geographic areas', color: '#ef4444' },
  { key: 'fire-detections', icon: '🔥', title: 'Fire Detections', desc: 'Real-time fire detection from satellites and sensors with AI analysis', color: '#f59e0b' },
  { key: 'evacuation-plans', icon: '🚨', title: 'Evacuation Plans', desc: 'AI-generated evacuation routes and phased evacuation strategies', color: '#ff6b35' },
  { key: 'resource-allocations', icon: '📦', title: 'Resource Allocations', desc: 'Optimized firefighting resource deployment using AI logistics', color: '#3b82f6' },
  { key: 'weather-analyses', icon: '🌤️', title: 'Weather Analyses', desc: 'Fire weather forecasting and condition monitoring with AI models', color: '#06b6d4' },
  { key: 'smoke-reports', icon: '💨', title: 'Smoke Reports', desc: 'Smoke sighting analysis and fire source identification with AI', color: '#8b5cf6' },
  { key: 'community-alerts', icon: '📢', title: 'Community Alerts', desc: 'AI-crafted emergency alerts with multi-language support', color: '#ec4899' },
  { key: 'damage-assessments', icon: '🏚️', title: 'Damage Assessments', desc: 'Post-fire damage evaluation and recovery planning by AI', color: '#6366f1' },
  { key: 'spread-predictions', icon: '📈', title: 'Spread Predictions', desc: 'AI fire behavior modeling and spread trajectory prediction', color: '#ef4444' },
  { key: 'water-sources', icon: '💧', title: 'Water Sources', desc: 'Water supply mapping and tactical assessment for firefighting', color: '#0ea5e9' },
  { key: 'crew-deployments', icon: '👷', title: 'Crew Deployments', desc: 'AI-optimized crew scheduling with fatigue and safety analysis', color: '#f97316' },
  { key: 'equipment-tracking', icon: '🚒', title: 'Equipment Tracking', desc: 'Equipment maintenance prediction and deployment optimization', color: '#10b981' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const endpoints = features.map(f => f.key);
    Promise.all(endpoints.map(ep => api.get(`/${ep}`).then(r => [ep, r.data.length]).catch(() => [ep, 0])))
      .then(results => {
        const c = {};
        results.forEach(([k, v]) => { c[k] = v; });
        setCounts(c);
      });
  }, []);

  return (
    <div>
      <div className="dashboard-header">
        <h1>Wildfire Command Center</h1>
        <p>AI-powered wildfire prediction, detection, and response management platform</p>
      </div>

      <div className="dashboard-grid">
        {features.map(f => (
          <div
            key={f.key}
            className="feature-card"
            style={{ '--card-accent': f.color }}
            onClick={() => navigate(`/${f.key}`)}
          >
            <div className="card-icon" style={{ background: `${f.color}20` }}>
              {f.icon}
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <div className="card-stats">
              <div className="stat">
                <strong>{counts[f.key] || 0}</strong>
                Records
              </div>
              <div className="stat">
                <strong>AI</strong>
                Powered
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
