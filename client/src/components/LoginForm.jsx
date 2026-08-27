import React, { useState } from 'react';
import { 
  Lock, Loader2, AlertTriangle, Database, ArrowRight, 
  ShieldCheck, Code2, LineChart, CheckCircle2, Eye, User, Sparkles
} from 'lucide-react';

export const STATIC_ACCOUNTS = [
  { 
    id: 'sysops', 
    username: 'sys_ops9x', 
    password: 'K9#vP$8xL2!zQ1', 
    role: 'System Administrator', 
    name: 'Ops Admin',
    badge: 'SysOps', 
    color: '#6366f1',
    icon: ShieldCheck,
    desc: 'Full access & administrative controls'
  },
  { 
    id: 'arch', 
    username: 'arch_lead4', 
    password: 'W4*mE#9tR7@yU3', 
    role: 'Lead Architect', 
    name: 'Lead Architect',
    badge: 'Arch', 
    color: '#06b6d4',
    icon: Code2,
    desc: 'Schema, SPs & architectural analysis'
  },
  { 
    id: 'data', 
    username: 'data_core7', 
    password: 'J7$nB&2hF5!pX8', 
    role: 'Data Engineer', 
    name: 'Data Engineer',
    badge: 'Data', 
    color: '#10b981',
    icon: LineChart,
    desc: 'Relationship & path discovery'
  },
  { 
    id: 'qa', 
    username: 'qa_audit2', 
    password: 'T3#kM%6wS9*vC4', 
    role: 'QA Auditor', 
    name: 'QA Auditor',
    badge: 'QA', 
    color: '#f59e0b',
    icon: CheckCircle2,
    desc: 'Diff compare & schema audits'
  },
  { 
    id: 'inspect', 
    username: 'inspect_x8', 
    password: 'R8@zY^5qD1!mN7', 
    role: 'Security Inspector', 
    name: 'Security Inspector',
    badge: 'Inspect', 
    color: '#8b5cf6',
    icon: Eye,
    desc: 'Read-only schema inspection'
  }
];

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState(STATIC_ACCOUNTS[0].username);
  const [password, setPassword] = useState(STATIC_ACCOUNTS[0].password);
  const [selectedAccountId, setSelectedAccountId] = useState(STATIC_ACCOUNTS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const performLogin = async (userToLogin, passToLogin) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: userToLogin || username, 
          password: passToLogin || password 
        })
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

  const handleSubmit = (e) => {
    e.preventDefault();
    performLogin(username, password);
  };

  const handleSelectAccount = (account, autoSubmit = false) => {
    setUsername(account.username);
    setPassword(account.password);
    setSelectedAccountId(account.id);
    setError(null);
    if (autoSubmit) {
      performLogin(account.username, account.password);
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
          <p className="auth-subtitle">Select any static demo account or enter credentials below</p>
        </div>

        {/* 5 Hard-to-Guess Static Accounts Selector */}
        <div className="static-accounts-section">
          <div className="static-accounts-header">
            <Sparkles size={13} className="sparkle-icon" />
            <span>5 Static Demo Accounts (1-Click Fill)</span>
          </div>
          <div className="static-accounts-grid">
            {STATIC_ACCOUNTS.map((acc) => {
              const IconComponent = acc.icon;
              const isSelected = selectedAccountId === acc.id && username === acc.username;
              return (
                <button
                  key={acc.id}
                  type="button"
                  className={`static-account-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectAccount(acc, false)}
                  title={`Click to fill: ${acc.username} (${acc.desc})`}
                >
                  <div className="chip-icon-wrapper" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}>
                    <IconComponent size={14} />
                  </div>
                  <div className="chip-info">
                    <span className="chip-name">{acc.badge}</span>
                    <span className="chip-role">{acc.username}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="alert alert-error auth-alert">
            <AlertTriangle size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field-group">
            <label className="form-field-label">Username / Login ID</label>
            <div className="input-with-icon">
              <input 
                type="text" 
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelectedAccountId(null);
                }}
                required
                className="form-input-field"
                placeholder="Enter username"
                autoFocus
              />
            </div>
          </div>

          <div className="form-field-group">
            <div className="form-label-row">
              <label className="form-field-label">Access Password</label>
              {selectedAccountId && (
                <span className="static-pass-hint">
                  Static pass: <code>{STATIC_ACCOUNTS.find(a => a.id === selectedAccountId)?.password}</code>
                </span>
              )}
            </div>
            <div className="input-with-icon">
              <input 
                type="password" 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setSelectedAccountId(null);
                }}
                required
                className="form-input-field"
                placeholder="Enter password"
              />
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
          <span>Protected Developer Session &bull; 5 Static Accounts Configured</span>
        </div>
      </div>
    </div>
  );
}
