import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

const featureConfigs = {
  'risk-assessments': {
    columns: ['location', 'vegetation_type', 'terrain', 'risk_level', 'risk_score'],
    columnLabels: { location: 'Location', vegetation_type: 'Vegetation', terrain: 'Terrain', risk_level: 'Risk Level', risk_score: 'Score' },
    fields: [
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
      { key: 'vegetation_type', label: 'Vegetation Type', type: 'text' },
      { key: 'terrain', label: 'Terrain', type: 'text' },
      { key: 'weather_conditions', label: 'Weather Conditions', type: 'textarea', fullWidth: true },
      { key: 'risk_level', label: 'Risk Level', type: 'select', options: ['Pending', 'Low', 'Medium', 'High', 'Critical'] },
      { key: 'risk_score', label: 'Risk Score (0-100)', type: 'number' },
    ],
    statusKey: 'risk_level',
    detailFields: ['location', 'latitude', 'longitude', 'vegetation_type', 'terrain', 'weather_conditions', 'risk_level', 'risk_score'],
  },
  'fire-detections': {
    columns: ['location', 'sensor_type', 'confidence_level', 'temperature', 'status'],
    columnLabels: { location: 'Location', sensor_type: 'Sensor', confidence_level: 'Confidence %', temperature: 'Temp (°F)', status: 'Status' },
    fields: [
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
      { key: 'sensor_type', label: 'Sensor Type', type: 'select', options: ['VIIRS', 'MODIS', 'GOES-16', 'Ground Sensor'] },
      { key: 'confidence_level', label: 'Confidence Level (%)', type: 'number' },
      { key: 'temperature', label: 'Temperature (°F)', type: 'number' },
      { key: 'satellite_source', label: 'Satellite Source', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Investigating', 'Monitoring', 'Contained', 'False Alarm'] },
    ],
    statusKey: 'status',
    detailFields: ['location', 'latitude', 'longitude', 'sensor_type', 'confidence_level', 'temperature', 'satellite_source', 'status'],
  },
  'evacuation-plans': {
    columns: ['zone_name', 'population', 'primary_route', 'status'],
    columnLabels: { zone_name: 'Zone', population: 'Population', primary_route: 'Primary Route', status: 'Status' },
    fields: [
      { key: 'zone_name', label: 'Zone Name', type: 'text', required: true },
      { key: 'population', label: 'Population', type: 'number' },
      { key: 'primary_route', label: 'Primary Route', type: 'text' },
      { key: 'secondary_route', label: 'Secondary Route', type: 'text' },
      { key: 'assembly_point', label: 'Assembly Point', type: 'text' },
      { key: 'special_needs_count', label: 'Special Needs Count', type: 'number' },
      { key: 'vehicles_estimated', label: 'Vehicles Estimated', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Active', 'Archived'] },
    ],
    statusKey: 'status',
    detailFields: ['zone_name', 'population', 'primary_route', 'secondary_route', 'assembly_point', 'special_needs_count', 'vehicles_estimated', 'status'],
  },
  'resource-allocations': {
    columns: ['incident_name', 'resource_type', 'quantity', 'priority', 'status'],
    columnLabels: { incident_name: 'Incident', resource_type: 'Resource', quantity: 'Qty', priority: 'Priority', status: 'Status' },
    fields: [
      { key: 'incident_name', label: 'Incident Name', type: 'text', required: true },
      { key: 'resource_type', label: 'Resource Type', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'estimated_cost', label: 'Estimated Cost ($)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Requested', 'En Route', 'Deployed', 'Completed'] },
    ],
    statusKey: 'status',
    detailFields: ['incident_name', 'resource_type', 'quantity', 'location', 'priority', 'estimated_cost', 'status'],
  },
  'weather-analyses': {
    columns: ['location', 'temperature', 'humidity', 'wind_speed', 'fire_weather_index'],
    columnLabels: { location: 'Location', temperature: 'Temp (°F)', humidity: 'Humidity %', wind_speed: 'Wind (mph)', fire_weather_index: 'FWI' },
    fields: [
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'temperature', label: 'Temperature (°F)', type: 'number' },
      { key: 'humidity', label: 'Humidity (%)', type: 'number' },
      { key: 'wind_speed', label: 'Wind Speed (mph)', type: 'number' },
      { key: 'wind_direction', label: 'Wind Direction', type: 'select', options: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
      { key: 'precipitation', label: 'Precipitation (in)', type: 'number' },
      { key: 'forecast_period', label: 'Forecast Period', type: 'select', options: ['24-hour', '48-hour', '72-hour', '7-day'] },
      { key: 'fire_weather_index', label: 'Fire Weather Index', type: 'number' },
    ],
    statusKey: null,
    detailFields: ['location', 'temperature', 'humidity', 'wind_speed', 'wind_direction', 'precipitation', 'forecast_period', 'fire_weather_index'],
  },
  'smoke-reports': {
    columns: ['location', 'smoke_color', 'smoke_density', 'reporter_name', 'status'],
    columnLabels: { location: 'Location', smoke_color: 'Color', smoke_density: 'Density', reporter_name: 'Reporter', status: 'Status' },
    fields: [
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
      { key: 'smoke_color', label: 'Smoke Color', type: 'select', options: ['White', 'Gray', 'Dark gray', 'Black', 'Brown', 'Yellow-gray', 'Blue-gray'] },
      { key: 'smoke_density', label: 'Smoke Density', type: 'select', options: ['Light', 'Moderate', 'Heavy', 'Very Heavy'] },
      { key: 'wind_direction', label: 'Wind Direction', type: 'text' },
      { key: 'reporter_name', label: 'Reporter Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Reported', 'Investigating', 'Confirmed', 'Monitoring', 'Resolved'] },
    ],
    statusKey: 'status',
    detailFields: ['location', 'latitude', 'longitude', 'smoke_color', 'smoke_density', 'wind_direction', 'reporter_name', 'description', 'status'],
  },
  'community-alerts': {
    columns: ['title', 'alert_type', 'severity', 'affected_area', 'status'],
    columnLabels: { title: 'Title', alert_type: 'Type', severity: 'Severity', affected_area: 'Area', status: 'Status' },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'alert_type', label: 'Alert Type', type: 'select', options: ['Evacuation Order', 'Evacuation Warning', 'Weather Alert', 'Health Advisory', 'Infrastructure', 'Shelter Order', 'All Clear', 'Utility Alert', 'Informational', 'Status Update'] },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      { key: 'affected_area', label: 'Affected Area', type: 'text' },
      { key: 'population_affected', label: 'Population Affected', type: 'number' },
      { key: 'message', label: 'Message', type: 'textarea', fullWidth: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Active', 'Resolved'] },
    ],
    statusKey: 'status',
    detailFields: ['title', 'alert_type', 'severity', 'affected_area', 'population_affected', 'message', 'status'],
  },
  'damage-assessments': {
    columns: ['incident_name', 'location', 'acres_burned', 'structures_destroyed', 'status'],
    columnLabels: { incident_name: 'Incident', location: 'Location', acres_burned: 'Acres', structures_destroyed: 'Destroyed', status: 'Status' },
    fields: [
      { key: 'incident_name', label: 'Incident Name', type: 'text', required: true },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'acres_burned', label: 'Acres Burned', type: 'number' },
      { key: 'structures_damaged', label: 'Structures Damaged', type: 'number' },
      { key: 'structures_destroyed', label: 'Structures Destroyed', type: 'number' },
      { key: 'estimated_cost', label: 'Estimated Cost ($)', type: 'number' },
      { key: 'injuries', label: 'Injuries', type: 'number' },
      { key: 'fatalities', label: 'Fatalities', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['In Progress', 'Completed', 'Under Review'] },
    ],
    statusKey: 'status',
    detailFields: ['incident_name', 'location', 'acres_burned', 'structures_damaged', 'structures_destroyed', 'estimated_cost', 'injuries', 'fatalities', 'status'],
  },
  'spread-predictions': {
    columns: ['fire_name', 'current_acres', 'wind_speed', 'wind_direction', 'status'],
    columnLabels: { fire_name: 'Fire Name', current_acres: 'Acres', wind_speed: 'Wind (mph)', wind_direction: 'Direction', status: 'Status' },
    fields: [
      { key: 'fire_name', label: 'Fire Name', type: 'text', required: true },
      { key: 'current_acres', label: 'Current Acres', type: 'number' },
      { key: 'wind_speed', label: 'Wind Speed (mph)', type: 'number' },
      { key: 'wind_direction', label: 'Wind Direction', type: 'select', options: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Variable'] },
      { key: 'terrain_type', label: 'Terrain Type', type: 'text' },
      { key: 'vegetation_density', label: 'Vegetation Density', type: 'select', options: ['Light', 'Moderate', 'Dense', 'Very Dense'] },
      { key: 'humidity', label: 'Humidity (%)', type: 'number' },
      { key: 'temperature', label: 'Temperature (°F)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Monitoring', 'Contained'] },
    ],
    statusKey: 'status',
    detailFields: ['fire_name', 'current_acres', 'wind_speed', 'wind_direction', 'terrain_type', 'vegetation_density', 'humidity', 'temperature', 'status'],
  },
  'water-sources': {
    columns: ['name', 'source_type', 'capacity_gallons', 'accessibility', 'status'],
    columnLabels: { name: 'Name', source_type: 'Type', capacity_gallons: 'Capacity (gal)', accessibility: 'Access', status: 'Status' },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'source_type', label: 'Source Type', type: 'select', options: ['Lake', 'Reservoir', 'River', 'Stream', 'Pond', 'Hydrant', 'Water Tank', 'Well', 'Spring', 'Cistern', 'Portable Tank'] },
      { key: 'latitude', label: 'Latitude', type: 'number' },
      { key: 'longitude', label: 'Longitude', type: 'number' },
      { key: 'capacity_gallons', label: 'Capacity (gallons)', type: 'number' },
      { key: 'accessibility', label: 'Accessibility', type: 'text' },
      { key: 'road_access', label: 'Road Access', type: 'text' },
      { key: 'helicopter_accessible', label: 'Helicopter Accessible', type: 'select', options: ['true', 'false'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Available', 'Deployed', 'Maintenance', 'Dry'] },
    ],
    statusKey: 'status',
    detailFields: ['name', 'source_type', 'latitude', 'longitude', 'capacity_gallons', 'accessibility', 'road_access', 'helicopter_accessible', 'status'],
  },
  'crew-deployments': {
    columns: ['crew_name', 'crew_size', 'specialization', 'assigned_incident', 'status'],
    columnLabels: { crew_name: 'Crew', crew_size: 'Size', specialization: 'Spec', assigned_incident: 'Incident', status: 'Status' },
    fields: [
      { key: 'crew_name', label: 'Crew Name', type: 'text', required: true },
      { key: 'crew_size', label: 'Crew Size', type: 'number' },
      { key: 'specialization', label: 'Specialization', type: 'text' },
      { key: 'assigned_incident', label: 'Assigned Incident', type: 'text' },
      { key: 'deployment_location', label: 'Deployment Location', type: 'text' },
      { key: 'shift_start', label: 'Shift Start', type: 'datetime-local' },
      { key: 'shift_end', label: 'Shift End', type: 'datetime-local' },
      { key: 'fatigue_level', label: 'Fatigue Level', type: 'select', options: ['Low', 'Moderate', 'High', 'Critical'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Deployed', 'Returning', 'Available', 'Rest'] },
    ],
    statusKey: 'status',
    detailFields: ['crew_name', 'crew_size', 'specialization', 'assigned_incident', 'deployment_location', 'shift_start', 'shift_end', 'fatigue_level', 'status'],
  },
  'equipment-tracking': {
    columns: ['equipment_name', 'equipment_type', 'current_location', 'condition', 'status'],
    columnLabels: { equipment_name: 'Equipment', equipment_type: 'Type', current_location: 'Location', condition: 'Condition', status: 'Status' },
    fields: [
      { key: 'equipment_name', label: 'Equipment Name', type: 'text', required: true },
      { key: 'equipment_type', label: 'Equipment Type', type: 'text' },
      { key: 'serial_number', label: 'Serial Number', type: 'text' },
      { key: 'current_location', label: 'Current Location', type: 'text' },
      { key: 'condition', label: 'Condition', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor'] },
      { key: 'last_maintenance', label: 'Last Maintenance', type: 'date' },
      { key: 'hours_used', label: 'Hours Used', type: 'number' },
      { key: 'assigned_to', label: 'Assigned To', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Operational', 'Maintenance', 'Out of Service'] },
    ],
    statusKey: 'status',
    detailFields: ['equipment_name', 'equipment_type', 'serial_number', 'current_location', 'condition', 'last_maintenance', 'hours_used', 'assigned_to', 'status'],
  },
};

function formatValue(key, val) {
  if (val === null || val === undefined) return '—';
  if (key === 'estimated_cost') return `$${Number(val).toLocaleString()}`;
  if (key === 'capacity_gallons') return Number(val).toLocaleString();
  if (key === 'helicopter_accessible') return val ? 'Yes' : 'No';
  if (key.includes('_at') || key === 'shift_start' || key === 'shift_end') {
    return new Date(val).toLocaleString();
  }
  if (typeof val === 'number' && !Number.isInteger(val)) return val.toFixed(1);
  return String(val);
}

function getStatusClass(val) {
  if (!val) return '';
  const v = String(val).toLowerCase().replace(/\s+/g, '-');
  const map = {
    'active': 'status-active', 'deployed': 'status-deployed', 'confirmed': 'status-confirmed',
    'contained': 'status-contained', 'completed': 'status-completed', 'resolved': 'status-resolved',
    'available': 'status-available', 'monitoring': 'status-monitoring', 'investigating': 'status-investigating',
    'draft': 'status-draft', 'pending': 'status-pending', 'operational': 'status-operational',
    'returning': 'status-returning', 'maintenance': 'status-maintenance',
    'critical': 'status-critical', 'high': 'status-high', 'medium': 'status-medium', 'low': 'status-low',
    'en-route': 'status-monitoring', 'requested': 'status-draft', 'false-alarm': 'status-completed',
    'in-progress': 'status-monitoring', 'reported': 'status-draft', 'rest': 'status-available',
  };
  return map[v] || '';
}

export default function FeaturePage({ feature, title }) {
  const config = featureConfigs[feature];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const { data } = await api.get(`/${feature}`);
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [feature]);

  useEffect(() => {
    setLoading(true);
    setSelectedItem(null);
    setShowForm(false);
    fetchItems();
  }, [feature, fetchItems]);

  const openCreate = () => {
    setEditItem(null);
    setFormData({});
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    const fd = {};
    config.fields.forEach(f => {
      let val = item[f.key];
      if (f.type === 'datetime-local' && val) val = new Date(val).toISOString().slice(0, 16);
      fd[f.key] = val || '';
    });
    setFormData(fd);
    setShowForm(true);
    setSelectedItem(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/${feature}/${editItem.id}`, formData);
      } else {
        await api.post(`/${feature}`, formData);
      }
      setShowForm(false);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete this ${title.slice(0, -1)}?`)) return;
    try {
      await api.delete(`/${feature}/${item.id}`);
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleAIAnalyze = async (item) => {
    setAnalyzing(true);
    try {
      const { data } = await api.post(`/${feature}/${item.id}/ai-analyze`);
      setSelectedItem(prev => ({ ...prev, ai_analysis: data.ai_analysis }));
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.error || 'AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner"></div>Loading {title}...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>{title}</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New {title.slice(0, -1)}</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>No {title} Yet</h3>
          <p>Create your first record to get started with AI analysis</p>
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {config.columns.map(col => (
                  <th key={col}>{config.columnLabels[col]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} onClick={() => setSelectedItem(item)}>
                  <td>{idx + 1}</td>
                  {config.columns.map(col => (
                    <td key={col}>
                      {(col === config.statusKey || col === 'risk_level' || col === 'severity' || col === 'priority' || col === 'fatigue_level') ? (
                        <span className={`status-badge ${getStatusClass(item[col])}`}>{item[col]}</span>
                      ) : formatValue(col, item[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedItem[config.detailFields[0]]}</h2>
              <button className="modal-close" onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {config.detailFields.map(key => (
                  <div key={key} className="detail-item">
                    <label>{config.fields.find(f => f.key === key)?.label || key}</label>
                    <div className="value">
                      {(key === config.statusKey || key === 'risk_level' || key === 'severity' || key === 'priority' || key === 'fatigue_level') ? (
                        <span className={`status-badge ${getStatusClass(selectedItem[key])}`}>{selectedItem[key]}</span>
                      ) : formatValue(key, selectedItem[key])}
                    </div>
                  </div>
                ))}
              </div>

              {selectedItem.ai_analysis && (
                <div className="ai-analysis-container">
                  <div className="ai-analysis-header">
                    <div className="ai-icon">🧠</div>
                    <h4>AI Analysis</h4>
                    <span className="model-tag">Claude Haiku 4.5</span>
                  </div>
                  <div className="ai-analysis-body">
                    <ReactMarkdown>{selectedItem.ai_analysis}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ai" onClick={() => handleAIAnalyze(selectedItem)} disabled={analyzing}>
                {analyzing ? '🔄 Analyzing...' : '🧠 AI Analyze'}
              </button>
              <button className="btn btn-secondary" onClick={() => openEdit(selectedItem)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selectedItem)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editItem ? 'Edit' : 'New'} {title.slice(0, -1)}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {config.fields.map(field => (
                  <div key={field.key} className={`form-group ${field.fullWidth ? 'full-width' : ''}`}>
                    <label>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.key] || ''}
                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={formData[field.key] || ''}
                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key] || ''}
                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                        step={field.type === 'number' ? 'any' : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : (editItem ? 'Update' : 'Create & AI Analyze')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
