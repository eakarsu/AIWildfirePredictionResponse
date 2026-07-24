import React, { useState } from 'react';
import api from '../services/api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const autoFill = () => {
    setEmail(process.env.REACT_APP_DEMO_EMAIL || '');
    setPassword(process.env.REACT_APP_DEMO_PASSWORD || '');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">🔥</div>
          <h1>AI Wildfire<br /><span>Prediction & Response</span></h1>
        </div>
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to access the wildfire management platform</p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button className="auto-fill-btn" onClick={autoFill}>
          Quick Login — Auto-fill Demo Credentials
        </button>
      </div>
    </div>
  );
}
