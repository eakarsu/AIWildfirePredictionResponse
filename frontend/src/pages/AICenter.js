import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';

const aiTools = [
  { key: 'risk-prediction', icon: '🎯', title: 'Risk Prediction', desc: 'Analyze wildfire risk for any location with AI-powered assessment' },
  { key: 'evacuation', icon: '🚨', title: 'Evacuation Planner', desc: 'Generate optimized evacuation strategies for communities' },
  { key: 'resource-optimization', icon: '📦', title: 'Resource Optimizer', desc: 'Optimize firefighting resource deployment and logistics' },
  { key: 'weather-fire', icon: '🌤️', title: 'Fire Weather Analysis', desc: 'Analyze weather patterns for wildfire risk and behavior' },
  { key: 'damage-recovery', icon: '🏚️', title: 'Damage & Recovery', desc: 'Assess post-fire damage and plan community recovery' },
  { key: 'prevention', icon: '🛡️', title: 'Prevention Planning', desc: 'Generate wildfire prevention and preparedness recommendations' },
  { key: 'training', icon: '🎓', title: 'Training Scenarios', desc: 'Create realistic training simulations for firefighter education' },
  { key: 'general', icon: '🧠', title: 'General Assistant', desc: 'Ask any wildfire-related question to the AI assistant' },
];

const quickTools = [
  { key: 'quick-risk', title: 'Quick Risk Assessment', fields: [
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'conditions', label: 'Current Conditions', type: 'textarea' },
  ]},
  { key: 'sitrep', title: 'Situation Report Generator', fields: [
    { key: 'incident_details', label: 'Incident Details', type: 'textarea' },
  ]},
  { key: 'fire-behavior', title: 'Fire Behavior Analysis', fields: [
    { key: 'fuel_type', label: 'Fuel Type', type: 'text' },
    { key: 'slope', label: 'Slope (%)', type: 'number' },
    { key: 'wind', label: 'Wind (mph)', type: 'number' },
    { key: 'moisture', label: 'Fuel Moisture (%)', type: 'number' },
  ]},
  { key: 'prevention', title: 'Prevention Recommendations', fields: [
    { key: 'area_description', label: 'Area Description', type: 'textarea' },
  ]},
  { key: 'training-scenario', title: 'Training Scenario Generator', fields: [
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
    { key: 'scenario_type', label: 'Scenario Type', type: 'select', options: ['Initial Attack', 'Structure Protection', 'Evacuation', 'Command', 'Weather Event', 'Multi-Agency'] },
    { key: 'crew_level', label: 'Crew Level', type: 'select', options: ['Volunteer', 'Type 2 Crew', 'Type 1 Crew', 'Hotshot', 'Incident Commander'] },
  ]},
];

export default function AICenter() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [activeQuickTool, setActiveQuickTool] = useState(null);
  const [quickFormData, setQuickFormData] = useState({});
  const [quickResult, setQuickResult] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai-center/query', { prompt: input, category });
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (err.response?.data?.error || 'AI service unavailable') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTool = async (toolKey) => {
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const { data } = await api.post(`/ai-center/${toolKey}`, quickFormData);
      setQuickResult(data.response);
    } catch (err) {
      setQuickResult('Error: ' + (err.response?.data?.error || 'AI service unavailable'));
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🧠 AI Command Center</h1>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15 }}>
        Access all AI-powered wildfire analysis tools in one place. Chat with the AI assistant or use specialized quick tools.
      </p>

      {/* AI Tools Grid */}
      <div className="ai-center-grid">
        {aiTools.map(tool => (
          <div key={tool.key} className="ai-tool-card" onClick={() => { setCategory(tool.key); document.getElementById('ai-chat-input')?.focus(); }}>
            <div className="tool-header">
              <div className="tool-icon">{tool.icon}</div>
              <h3>{tool.title}</h3>
            </div>
            <p>{tool.desc}</p>
            <button className="btn btn-ai btn-sm" onClick={(e) => { e.stopPropagation(); setCategory(tool.key); }}>
              Select Mode
            </button>
          </div>
        ))}
      </div>

      {/* Quick Tools */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, marginTop: 8 }}>Quick AI Tools</h2>
      <div className="ai-center-grid" style={{ marginBottom: 32 }}>
        {quickTools.map(tool => (
          <div key={tool.key} className="ai-tool-card">
            <h3 style={{ marginBottom: 16 }}>{tool.title}</h3>
            {activeQuickTool === tool.key ? (
              <div>
                {tool.fields.map(field => (
                  <div key={field.key} className="form-group" style={{ marginBottom: 12 }}>
                    <label>{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea value={quickFormData[field.key] || ''} onChange={e => setQuickFormData({ ...quickFormData, [field.key]: e.target.value })} rows={3} />
                    ) : field.type === 'select' ? (
                      <select value={quickFormData[field.key] || ''} onChange={e => setQuickFormData({ ...quickFormData, [field.key]: e.target.value })}>
                        <option value="">Select...</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={quickFormData[field.key] || ''} onChange={e => setQuickFormData({ ...quickFormData, [field.key]: e.target.value })} />
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ai btn-sm" onClick={() => handleQuickTool(tool.key)} disabled={quickLoading}>
                    {quickLoading ? '🔄 Analyzing...' : '🧠 Analyze'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setActiveQuickTool(null); setQuickResult(null); setQuickFormData({}); }}>Close</button>
                </div>
                {quickResult && (
                  <div className="ai-analysis-container" style={{ marginTop: 16 }}>
                    <div className="ai-analysis-header">
                      <div className="ai-icon">🧠</div>
                      <h4>AI Result</h4>
                      <span className="model-tag">Claude Haiku 4.5</span>
                    </div>
                    <div className="ai-analysis-body">
                      <ReactMarkdown>{quickResult}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => { setActiveQuickTool(tool.key); setQuickFormData({}); setQuickResult(null); }}>
                Open Tool
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Chat Interface */}
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>AI Chat Assistant</h2>
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Wildfire AI Assistant</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mode: {aiTools.find(t => t.key === category)?.title || 'General'}</div>
          </div>
        </div>

        <div className="ai-chat-messages">
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="icon">💬</div>
              <h3>Start a Conversation</h3>
              <p>Ask anything about wildfire prediction, detection, response, or prevention</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="message-avatar">{msg.role === 'user' ? '👤' : '🧠'}</div>
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {loading && (
            <div className="ai-message assistant">
              <div className="message-avatar">🧠</div>
              <div className="message-content">
                <div className="loading-spinner" style={{ padding: 8 }}><div className="spinner"></div> Thinking...</div>
              </div>
            </div>
          )}
        </div>

        <div className="ai-chat-input">
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {aiTools.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
          </select>
          <input
            id="ai-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask the AI assistant..."
          />
          <button className="btn btn-ai" onClick={sendMessage} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
