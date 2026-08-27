import React, { useState, useEffect } from 'react';
import { Database, Loader2, Server, Plug, AlertCircle, LogOut, ArrowRight, Sparkles } from 'lucide-react';

export default function ConnectionForm({ onConnect, loading, error, onLogout }) {
  const [tab, setTab] = useState('manual');
  const [connString, setConnString] = useState('');
  
  const [server, setServer] = useState('');
  const [port, setPort] = useState('1433');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('db_visual_last_conn');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.server) setServer(parsed.server);
        if (parsed.port) setPort(parsed.port);
        if (parsed.database) setDatabase(parsed.database);
        if (parsed.user) setUser(parsed.user);
      } catch(e) {}
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === 'string') {
      onConnect({ connectionString: connString });
    } else {
      localStorage.setItem('db_visual_last_conn', JSON.stringify({ server, port, database, user }));
      onConnect({ server, port, database, user, password });
    }
  };

  return (
    <div className="connection-wrapper">
      <div className="connection-card glass">
        {/* Header */}
        <div className="connection-card-header">
          <div className="connection-logo-badge">
            <Database size={28} className="connection-logo-icon" />
          </div>
          <h1 className="connection-title">Connect Database</h1>
          <p className="connection-subtitle">Connect to your Microsoft SQL Server instance</p>
        </div>
        
        {/* Segmented Mode Tabs */}
        <div className="connection-tabs-bar">
          <button 
            className={`connection-tab ${tab === 'manual' ? 'active' : ''}`}
            onClick={() => setTab('manual')}
            type="button"
          >
            <Server size={14} />
            <span>Manual Config</span>
          </button>
          <button 
            className={`connection-tab ${tab === 'string' ? 'active' : ''}`}
            onClick={() => setTab('string')}
            type="button"
          >
            <Plug size={14} />
            <span>Connection String</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-error auth-alert">
            <AlertCircle size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="connection-form">
          {tab === 'string' ? (
            <div className="form-field-group">
              <label className="form-field-label">Connection String</label>
              <textarea 
                rows="4" 
                placeholder="Server=localhost;Database=myDb;User Id=sa;Password=myPassword;TrustServerCertificate=true;"
                value={connString}
                onChange={e => setConnString(e.target.value)}
                className="form-textarea-field"
                required
              />
              <span className="form-field-hint">Supports standard ADO.NET and OLEDB connection strings.</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div className="form-field-group">
                  <label className="form-field-label">
                    Server / Host
                    {server && <span className="field-subtle-hint">(Last: {server})</span>}
                  </label>
                  <input 
                    type="text" 
                    value={server} 
                    onChange={e => setServer(e.target.value)} 
                    required 
                    placeholder="localhost or SERVER\INSTANCE" 
                    className="form-input-field"
                  />
                </div>
                <div className="form-field-group">
                  <label className="form-field-label">Port</label>
                  <input 
                    type="text" 
                    value={port} 
                    onChange={e => setPort(e.target.value)} 
                    required 
                    className="form-input-field"
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label className="form-field-label">Initial Database</label>
                <input 
                  type="text" 
                  value={database} 
                  onChange={e => setDatabase(e.target.value)} 
                  placeholder="master or custom DB name" 
                  className="form-input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field-group">
                  <label className="form-field-label">Username (SQL Auth)</label>
                  <input 
                    type="text" 
                    value={user} 
                    onChange={e => setUser(e.target.value)} 
                    required 
                    placeholder="sa" 
                    className="form-input-field"
                  />
                </div>
                <div className="form-field-group">
                  <label className="form-field-label">Password</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    placeholder="••••••••" 
                    className="form-input-field"
                  />
                </div>
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary connection-submit-btn" 
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            <span>{loading ? 'Connecting...' : 'Connect & Visualise Schema'}</span>
            {!loading && <ArrowRight size={15} />}
          </button>

          {onLogout && (
            <button 
              type="button" 
              onClick={onLogout}
              className="btn-link-secondary"
            >
              <LogOut size={14} />
              <span>Log Out of Session</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
