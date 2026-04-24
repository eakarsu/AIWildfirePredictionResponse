import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FeaturePage from './pages/FeaturePage';
import AICenter from './pages/AICenter';
import Sidebar from './components/Sidebar';
import './styles/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} user={user} onLogout={handleLogout} />
        <main className={`main-content ${sidebarOpen ? '' : 'expanded'}`}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/risk-assessments" element={<FeaturePage feature="risk-assessments" title="Risk Assessments" />} />
            <Route path="/fire-detections" element={<FeaturePage feature="fire-detections" title="Fire Detections" />} />
            <Route path="/evacuation-plans" element={<FeaturePage feature="evacuation-plans" title="Evacuation Plans" />} />
            <Route path="/resource-allocations" element={<FeaturePage feature="resource-allocations" title="Resource Allocations" />} />
            <Route path="/weather-analyses" element={<FeaturePage feature="weather-analyses" title="Weather Analyses" />} />
            <Route path="/smoke-reports" element={<FeaturePage feature="smoke-reports" title="Smoke Reports" />} />
            <Route path="/community-alerts" element={<FeaturePage feature="community-alerts" title="Community Alerts" />} />
            <Route path="/damage-assessments" element={<FeaturePage feature="damage-assessments" title="Damage Assessments" />} />
            <Route path="/spread-predictions" element={<FeaturePage feature="spread-predictions" title="Spread Predictions" />} />
            <Route path="/water-sources" element={<FeaturePage feature="water-sources" title="Water Sources" />} />
            <Route path="/crew-deployments" element={<FeaturePage feature="crew-deployments" title="Crew Deployments" />} />
            <Route path="/equipment-tracking" element={<FeaturePage feature="equipment-tracking" title="Equipment Tracking" />} />
            <Route path="/ai-center" element={<AICenter />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
