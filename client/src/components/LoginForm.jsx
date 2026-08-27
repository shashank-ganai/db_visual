import React, { useState } from 'react';
import { Lock, Loader2, AlertTriangle, Database, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react';

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }
      
      if (data.success) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass">
        {/* Logo & Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <Database size={30} className="auth-logo-icon" />
          </div>
          <h1 className="auth-title">DB Visualizer</h1>
          <p className="auth-subtitle">Enter your credentials to access the database visualizer</p>
        </div>

        {error && (
          <div className="alert alert-error auth-alert">
            <AlertTriangle size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field-group">
            <label className="form-field-label">Username / Access ID</label>
            <div className="input-with-icon">
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="form-input-field"
                placeholder="Enter access ID"
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-field-group">
            <label className="form-field-label">Password</label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input-field"
                placeholder="Enter password"
                autoComplete="current-password"
                style={{ paddingRight: '38px' }}
              />
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setShowPassword(prev => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary auth-submit-btn"
            disabled={loading || !username || !password}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            {!loading && <ArrowRight size={15} style={{ marginLeft: '2px' }} />}
          </button>
        </form>

        <div className="auth-footer-hint">
          <Shield size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
          <span>Protected Developer Session &bull; Authentication Required</span>
        </div>
      </div>
    </div>
  );
}
