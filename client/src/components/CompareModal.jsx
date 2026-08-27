import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, ArrowRightLeft, AlertTriangle, Database, Loader2, FileCode2, 
  Table2, Info, CheckCircle2, Server, Plug, Bookmark, Trash2, 
  RefreshCw, Check, Sparkles, ChevronDown, ChevronUp, Maximize2, 
  Minimize2, Search, SlidersHorizontal, Copy, Split, AlignJustify,
  Settings2, Eye
} from 'lucide-react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { compareDatabases, normalizeSql } from '../utils/schemaCompare';

export default function CompareModal({ isOpen, onClose, currentDatabase, databases, currentSchema, currentSps }) {
  // Window State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef(null);

  // Setup / Mode State
  const [targetMode, setTargetMode] = useState('same-server'); // 'same-server' or 'different-server'
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);

  // Same Server Selection
  const [sameServerDb, setSameServerDb] = useState('');

  // Different Server Configuration
  const [targetAuthTab, setTargetAuthTab] = useState('string'); // 'string' or 'manual'
  const [targetConnString, setTargetConnString] = useState('');
  const [manualConfig, setManualConfig] = useState({
    server: '',
    port: '1433',
    database: '',
    user: '',
    password: ''
  });

  // Remote Server State
  const [remoteDatabases, setRemoteDatabases] = useState([]);
  const [remoteSelectedDb, setRemoteSelectedDb] = useState('');
  const [isTestingTarget, setIsTestingTarget] = useState(false);
  const [testStatus, setTestStatus] = useState(null); // { success: boolean, message: string }

  // Target Profiles (Stored in localStorage)
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [profileNameInput, setProfileNameInput] = useState('');
  const [showSaveProfile, setShowSaveProfile] = useState(false);

  // Comparison Options & Results
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [targetInfoForDiff, setTargetInfoForDiff] = useState(null);
  const [activeTab, setActiveTab] = useState('tables'); // 'tables' or 'sps'
  const [selectedItem, setSelectedItem] = useState(null);

  // Load saved configurations on mount / when opening
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTestStatus(null);
      setSelectedItem(null);
      
      // Load saved profiles
      try {
        const saved = localStorage.getItem('db_visual_compare_profiles');
        if (saved) setSavedProfiles(JSON.parse(saved));
      } catch (e) {}

      // Load last used target connection string
      try {
        const lastStr = localStorage.getItem('db_visual_last_target_cs');
        if (lastStr) setTargetConnString(lastStr);

        const lastManual = localStorage.getItem('db_visual_last_target_manual');
        if (lastManual) setManualConfig(JSON.parse(lastManual));
      } catch (e) {}
    }
  }, [isOpen]);

  // Sidebar drag resizer
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(260, Math.min(650, e.clientX - (resizeRef.current ? resizeRef.current.getBoundingClientRect().left : 0) + sidebarWidth));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const getTargetConfig = () => {
    if (targetAuthTab === 'string') {
      return { connectionString: targetConnString };
    }
    return {
      server: manualConfig.server,
      port: manualConfig.port || '1433',
      database: manualConfig.database,
      user: manualConfig.user,
      password: manualConfig.password
    };
  };

  const handleTestAndFetchDatabases = async () => {
    const config = getTargetConfig();
    if (targetAuthTab === 'string' && !targetConnString.trim()) {
      setTestStatus({ success: false, message: 'Please enter a target connection string' });
      return;
    }
    if (targetAuthTab === 'manual' && (!manualConfig.server || !manualConfig.user)) {
      setTestStatus({ success: false, message: 'Server host and username are required' });
      return;
    }

    setIsTestingTarget(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/compare/target-databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetConfig: config })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect to target database server');

      const dbs = data.databases || [];
      setRemoteDatabases(dbs);
      
      const initialDb = data.currentDatabase || (dbs.length > 0 ? dbs[0] : '') || manualConfig.database;
      if (initialDb) setRemoteSelectedDb(initialDb);

      setTestStatus({
        success: true,
        message: `Successfully connected! Found ${dbs.length} databases on remote server.`
      });

      if (targetAuthTab === 'string') {
        localStorage.setItem('db_visual_last_target_cs', targetConnString);
      } else {
        localStorage.setItem('db_visual_last_target_manual', JSON.stringify(manualConfig));
      }
    } catch (err) {
      setTestStatus({ success: false, message: err.message });
    } finally {
      setIsTestingTarget(false);
    }
  };

  const handleSaveProfile = () => {
    if (!profileNameInput.trim()) return;
    const newProfile = {
      id: Date.now().toString(),
      name: profileNameInput.trim(),
      authTab: targetAuthTab,
      config: targetAuthTab === 'string' ? { connectionString: targetConnString } : { ...manualConfig }
    };
    const updated = [...savedProfiles.filter(p => p.name !== newProfile.name), newProfile];
    setSavedProfiles(updated);
    localStorage.setItem('db_visual_compare_profiles', JSON.stringify(updated));
    setProfileNameInput('');
    setShowSaveProfile(false);
  };

  const handleLoadProfile = (profile) => {
    setTargetMode('different-server');
    setTargetAuthTab(profile.authTab || (profile.config.connectionString ? 'string' : 'manual'));
    if (profile.config.connectionString) {
      setTargetConnString(profile.config.connectionString);
    } else {
      setManualConfig({ ...profile.config });
    }
    setTestStatus(null);
    setRemoteDatabases([]);
  };

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    setSelectedItem(null);

    const isSameServer = targetMode === 'same-server';
    const effectiveTargetDb = isSameServer ? sameServerDb : remoteSelectedDb;

    if (!effectiveTargetDb && isSameServer) {
      setError('Please select a target database to compare.');
      setLoading(false);
      return;
    }

    try {
      const payload = isSameServer 
        ? { sameServer: true, dbName: sameServerDb }
        : { 
            sameServer: false, 
            targetConfig: getTargetConfig(), 
            dbName: remoteSelectedDb 
          };

      const res = await fetch('/api/compare/full-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to fetch target schema for comparison');

      // Run comparison with whitespace normalization option
      const diff = compareDatabases(currentSchema, data.schema, currentSps, data.sps, { ignoreWhitespace });
      setDiffResult(diff);

      const targetLabel = isSameServer 
        ? sameServerDb 
        : (remoteSelectedDb ? `${remoteSelectedDb} (Remote)` : 'Remote Target');

      setTargetInfoForDiff({
        sameServer: isSameServer,
        dbName: effectiveTargetDb,
        targetConfig: isSameServer ? null : getTargetConfig(),
        label: targetLabel,
        targetSchema: data.schema,
        targetSps: data.sps
      });

      // Automatically collapse config panel to maximize workspace view
      setIsConfigExpanded(false);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-run comparison when ignoreWhitespace option changes
  useEffect(() => {
    if (diffResult && targetInfoForDiff) {
      const diff = compareDatabases(
        currentSchema, 
        targetInfoForDiff.targetSchema, 
        currentSps, 
        targetInfoForDiff.targetSps, 
        { ignoreWhitespace }
      );
      setDiffResult(diff);
    }
  }, [ignoreWhitespace]);

  // Filter items in active tab by search query
  const filteredDiffResult = useMemo(() => {
    if (!diffResult) return null;
    const q = filterQuery.toLowerCase().trim();
    if (!q) return diffResult;

    const filterList = (items, isTable) => {
      return items.filter(item => {
        const name = isTable
          ? (item.tableName || `${item.schema}.${item.name}`)
          : (item.source ? `${item.source.schema_name}.${item.source.sp_name}` : `${item.schema_name}.${item.sp_name}`);
        return name.toLowerCase().includes(q);
      });
    };

    return {
      tables: {
        onlyInSource: filterList(diffResult.tables.onlyInSource, true),
        onlyInTarget: filterList(diffResult.tables.onlyInTarget, true),
        modified: filterList(diffResult.tables.modified, true)
      },
      sps: {
        onlyInSource: filterList(diffResult.sps.onlyInSource, false),
        onlyInTarget: filterList(diffResult.sps.onlyInTarget, false),
        modified: filterList(diffResult.sps.modified, false)
      }
    };
  }, [diffResult, filterQuery]);

  if (!isOpen) return null;

  const isTargetConfigured = targetMode === 'same-server' 
    ? !!sameServerDb 
    : (targetAuthTab === 'string' ? !!targetConnString.trim() : !!(manualConfig.server && manualConfig.user));

  const totalDifferences = diffResult 
    ? (diffResult.tables.onlyInSource.length + 
       diffResult.tables.onlyInTarget.length + 
       diffResult.tables.modified.length + 
       diffResult.sps.onlyInSource.length + 
       diffResult.sps.onlyInTarget.length + 
       diffResult.sps.modified.length)
    : 0;

  return (
    <div className="modal-overlay">
      <div 
        className={`modal-content compare-modal ${isFullscreen ? 'fullscreen' : ''}`} 
        style={{ 
          maxWidth: isFullscreen ? '100vw' : '1400px', 
          width: isFullscreen ? '100vw' : '96%', 
          height: isFullscreen ? '100vh' : '92vh', 
          display: 'flex', 
          flexDirection: 'column',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        
        {/* Header Bar */}
        <div className="modal-header" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(0, 212, 255, 0.15)', padding: '6px', borderRadius: '6px', color: 'var(--accent)' }}>
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Database Comparison
                {diffResult && (
                  <span style={{ 
                    fontSize: '0.7rem', 
                    background: totalDifferences === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                    color: totalDifferences === 0 ? 'var(--success)' : 'var(--warning)', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontWeight: 600
                  }}>
                    {totalDifferences === 0 ? 'Identical' : `${totalDifferences} Diff${totalDifferences > 1 ? 's' : ''}`}
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className="btn-icon" 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              title={isFullscreen ? "Restore window" : "Maximize window"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: 0 }}>
          
          {/* Collapsible Connection Setup Panel */}
          {isConfigExpanded ? (
            <div className="compare-setup-card glass" style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border)', 
              borderRadius: '10px', 
              padding: '1rem', 
              marginBottom: '0.75rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1.3fr', gap: '1rem', alignItems: 'start' }}>
                
                {/* Left: Source (Server 1) */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                      Source Database (Server 1)
                    </span>
                    <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      Active Session
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                    <Database size={17} color="var(--accent)" />
                    <span>{currentDatabase || 'Connected Database'}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {currentSchema?.tables?.length || 0} Tables &bull; {currentSps?.length || 0} Stored Procedures
                  </div>
                </div>

                {/* Center Icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: '1rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <ArrowRightLeft size={16} />
                  </div>
                </div>

                {/* Right: Target Server Configuration */}
                <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                      Target Database (Server 2)
                    </span>
                    
                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setTargetMode('same-server')}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: targetMode === 'same-server' ? 'var(--accent)' : 'transparent',
                          color: targetMode === 'same-server' ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        Same Server
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetMode('different-server')}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          background: targetMode === 'different-server' ? 'var(--accent)' : 'transparent',
                          color: targetMode === 'different-server' ? '#fff' : 'var(--text-secondary)'
                        }}
                      >
                        Different Server / Conn String
                      </button>
                    </div>
                  </div>

                  {targetMode === 'same-server' ? (
                    <div>
                      <select 
                        value={sameServerDb} 
                        onChange={(e) => setSameServerDb(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Select Target Database on Same Server --</option>
                        {databases.filter(db => db !== currentDatabase).map(db => (
                          <option key={db} value={db}>{db}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      {/* Different Server Sub-Tabs & Saved Profiles Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setTargetAuthTab('string')}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              background: targetAuthTab === 'string' ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                              color: targetAuthTab === 'string' ? 'var(--accent)' : 'var(--text-tertiary)',
                              fontWeight: targetAuthTab === 'string' ? 'bold' : 'normal'
                            }}
                          >
                            Connection String
                          </button>
                          <button
                            type="button"
                            onClick={() => setTargetAuthTab('manual')}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              background: targetAuthTab === 'manual' ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                              color: targetAuthTab === 'manual' ? 'var(--accent)' : 'var(--text-tertiary)',
                              fontWeight: targetAuthTab === 'manual' ? 'bold' : 'normal'
                            }}
                          >
                            Manual Fields
                          </button>
                        </div>

                        {savedProfiles.length > 0 && (
                          <select
                            onChange={(e) => {
                              const found = savedProfiles.find(p => p.id === e.target.value);
                              if (found) handleLoadProfile(found);
                              e.target.value = '';
                            }}
                            defaultValue=""
                            style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                          >
                            <option value="" disabled>Saved Profiles ({savedProfiles.length})</option>
                            {savedProfiles.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {targetAuthTab === 'string' ? (
                        <div>
                          <textarea
                            rows="2"
                            placeholder="Server=remote-server;Database=target_db;User Id=sa;Password=secret;"
                            value={targetConnString}
                            onChange={(e) => { setTargetConnString(e.target.value); setTestStatus(null); }}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              borderRadius: '6px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontFamily: 'monospace',
                              resize: 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.35rem' }}>
                          <input
                            type="text"
                            placeholder="Server / Host"
                            value={manualConfig.server}
                            onChange={(e) => { setManualConfig({ ...manualConfig, server: e.target.value }); setTestStatus(null); }}
                            style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Port"
                            value={manualConfig.port}
                            onChange={(e) => { setManualConfig({ ...manualConfig, port: e.target.value }); setTestStatus(null); }}
                            style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                          />
                          <input
                            type="text"
                            placeholder="User"
                            value={manualConfig.user}
                            onChange={(e) => { setManualConfig({ ...manualConfig, user: e.target.value }); setTestStatus(null); }}
                            style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={manualConfig.password}
                            onChange={(e) => { setManualConfig({ ...manualConfig, password: e.target.value }); setTestStatus(null); }}
                            style={{ padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Database Name"
                            value={manualConfig.database}
                            onChange={(e) => { setManualConfig({ ...manualConfig, database: e.target.value }); setTestStatus(null); }}
                            style={{ gridColumn: 'span 2', padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                          />
                        </div>
                      )}

                      {/* Remote Test / DB Selector */}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={handleTestAndFetchDatabases}
                          disabled={isTestingTarget}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isTestingTarget ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                          Test & Fetch DBs
                        </button>

                        {remoteDatabases.length > 0 && (
                          <select
                            value={remoteSelectedDb}
                            onChange={(e) => setRemoteSelectedDb(e.target.value)}
                            style={{ flex: 1, padding: '0.35rem', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.75rem' }}
                          >
                            <option value="">-- Select Remote Database --</option>
                            {remoteDatabases.map(db => (
                              <option key={db} value={db}>{db}</option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowSaveProfile(!showSaveProfile)}
                          title="Save this server profile"
                          className="btn-icon"
                          style={{ padding: '0.35rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border)' }}
                        >
                          <Bookmark size={13} color="var(--text-secondary)" />
                        </button>
                      </div>

                      {showSaveProfile && (
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', background: 'var(--bg-secondary)', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <input
                            type="text"
                            placeholder="Profile Name (e.g. UAT Server)"
                            value={profileNameInput}
                            onChange={(e) => setProfileNameInput(e.target.value)}
                            style={{ flex: 1, padding: '0.3rem', fontSize: '0.72rem', borderRadius: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                          />
                          <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={!profileNameInput.trim()}
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem' }}
                          >
                            Save
                          </button>
                        </div>
                      )}

                      {testStatus && (
                        <div style={{
                          marginTop: '0.35rem',
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: testStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: testStatus.success ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${testStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {testStatus.success ? <Check size={13} /> : <AlertTriangle size={13} />}
                          <span>{testStatus.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ignoreWhitespace}
                    onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Ignore Whitespace & Line Ending differences in Stored Procedures</span>
                </label>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {diffResult && (
                    <button
                      className="btn"
                      onClick={() => setIsConfigExpanded(false)}
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      Hide Configuration
                    </button>
                  )}
                  <button 
                    className="btn btn-primary" 
                    onClick={handleCompare} 
                    disabled={!isTargetConfigured || loading}
                    style={{ padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    Run Full Comparison
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Compact Summary Bar when collapsed */
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '0.5rem 1rem', 
              marginBottom: '0.75rem',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Source:</span>
                  <strong style={{ color: 'var(--accent)' }}>{currentDatabase}</strong>
                </div>
                <ArrowRightLeft size={14} color="var(--text-tertiary)" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Target:</span>
                  <strong style={{ color: 'var(--accent)' }}>{targetInfoForDiff?.label || 'Target'}</strong>
                </div>
                <div className="toolbar-divider" style={{ height: '16px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={ignoreWhitespace}
                    onChange={(e) => setIgnoreWhitespace(e.target.checked)}
                  />
                  <span>Ignore Whitespace</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleCompare}
                  disabled={loading}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Re-Compare
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setIsConfigExpanded(true)}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Settings2 size={13} />
                  Change Target Config
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={17} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
              {error}
            </div>
          )}

          {/* Results: Identical */}
          {filteredDiffResult && totalDifferences === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', padding: '2rem', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <CheckCircle2 size={36} color="var(--success)" />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Databases are Identical!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', lineHeight: '1.5' }}>
                No differences found in tables, columns, primary/foreign keys, or stored procedures between <strong>{currentDatabase}</strong> and <strong>{targetInfoForDiff?.label || 'Target DB'}</strong>.
              </p>
            </div>
          )}

          {/* Results: Differences Found */}
          {filteredDiffResult && totalDifferences > 0 && (
            <div className="compare-results" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              
              {/* Tabs & Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem', flexShrink: 0, paddingBottom: '0.25rem' }}>
                <div className="tabs" style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`} 
                    onClick={() => { setActiveTab('tables'); setSelectedItem(null); }}
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: activeTab === 'tables' ? '2px solid var(--accent)' : '2px solid transparent', 
                      color: activeTab === 'tables' ? 'var(--accent)' : 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <Table2 size={15} />
                    Tables ({diffResult.tables.onlyInSource.length + diffResult.tables.onlyInTarget.length + diffResult.tables.modified.length})
                  </button>
                  <button 
                    className={`tab-btn ${activeTab === 'sps' ? 'active' : ''}`} 
                    onClick={() => { setActiveTab('sps'); setSelectedItem(null); }}
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: activeTab === 'sps' ? '2px solid var(--accent)' : '2px solid transparent', 
                      color: activeTab === 'sps' ? 'var(--accent)' : 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem'
                    }}
                  >
                    <FileCode2 size={15} />
                    Stored Procedures ({diffResult.sps.onlyInSource.length + diffResult.sps.onlyInTarget.length + diffResult.sps.modified.length})
                  </button>
                </div>

                {/* Filter Search Box */}
                <div style={{ position: 'relative', width: '240px' }}>
                  <Search size={14} color="var(--text-tertiary)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder={`Filter ${activeTab}...`}
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem 0.6rem 0.35rem 1.8rem', fontSize: '0.75rem', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  />
                  {filterQuery && (
                    <button 
                      onClick={() => setFilterQuery('')}
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '2px', color: 'var(--text-tertiary)' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Main Content Pane (Resizable Splitter) */}
              <div 
                ref={resizeRef}
                className="tab-content" 
                style={{ flex: 1, display: 'flex', gap: '0', overflow: 'hidden', minHeight: 0 }}
              >
                
                {/* LEFT SIDEBAR: Lists */}
                <div style={{ width: `${sidebarWidth}px`, minWidth: '240px', maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.5rem', flexShrink: 0 }}>
                  
                  <DiffList 
                    title="Missing in Target (Only in Source)"
                    items={filteredDiffResult[activeTab].onlyInSource}
                    type={activeTab}
                    category="onlyInSource"
                    color="var(--success)"
                    bgColor="rgba(16, 185, 129, 0.1)"
                    icon="+"
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                  />

                  <DiffList 
                    title="Missing in Source (Only in Target)"
                    items={filteredDiffResult[activeTab].onlyInTarget}
                    type={activeTab}
                    category="onlyInTarget"
                    color="var(--danger)"
                    bgColor="rgba(239, 68, 68, 0.1)"
                    icon="-"
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                  />

                  <DiffList 
                    title={activeTab === 'tables' ? "Modified Tables" : "Modified Stored Procedures"}
                    items={filteredDiffResult[activeTab].modified}
                    type={activeTab}
                    category="modified"
                    color="var(--warning)"
                    bgColor="rgba(245, 158, 11, 0.1)"
                    icon="~"
                    selectedItem={selectedItem}
                    onSelect={setSelectedItem}
                  />

                  {filteredDiffResult[activeTab].onlyInSource.length === 0 &&
                   filteredDiffResult[activeTab].onlyInTarget.length === 0 &&
                   filteredDiffResult[activeTab].modified.length === 0 && (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                      No {activeTab} match filter "{filterQuery}"
                    </div>
                  )}
                  
                </div>

                {/* Resizer Handle */}
                <div 
                  className={`compare-resizer ${isResizing ? 'dragging' : ''}`}
                  onMouseDown={() => setIsResizing(true)}
                  title="Drag to resize panel"
                />

                {/* RIGHT SIDEBAR: Details & Full Height Code Diff */}
                <div style={{ flex: 1, overflow: 'hidden', paddingLeft: '0.75rem', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {selectedItem ? (
                    <ItemDetail item={selectedItem} targetInfo={targetInfoForDiff} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <Eye size={40} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select any item from the left panel to inspect detailed differences.</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>Click any modified stored procedure or table to view side-by-side SQL diffs.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Initial State */}
          {!diffResult && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <ArrowRightLeft size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Configure the target database above and click <strong>Run Full Comparison</strong> to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffList({ title, items, type, category, color, bgColor, icon, selectedItem, onSelect }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <h4 style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span style={{ color, background: bgColor, width: '15px', height: '15px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.68rem' }}>{icon}</span>
        {title} ({items.length})
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map((item, i) => {
          let name;
          if (category === 'modified') {
            name = type === 'tables' ? item.tableName : `${item.source.schema_name}.${item.source.sp_name}`;
          } else {
            name = type === 'tables' ? `${item.schema}.${item.name}` : `${item.schema_name}.${item.sp_name}`;
          }
          
          const isSelected = selectedItem && selectedItem.category === category && selectedItem.name === name;

          return (
            <div 
              key={`${name}-${i}`} 
              onClick={() => onSelect({ type, category, name, data: item, color, bgColor })}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                background: isSelected ? bgColor : 'transparent',
                color: isSelected ? color : 'var(--text-primary)',
                borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
                fontSize: '0.82rem',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {type === 'tables' ? <Table2 size={13} /> : <FileCode2 size={13} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemDetail({ item, targetInfo }) {
  return (
    <div className="item-detail-panel" style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      
      {/* Header */}
      <div className="detail-header" style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: item.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ color: item.color, background: 'var(--bg-primary)', width: '30px', height: '30px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.type === 'tables' ? <Table2 size={16} /> : <FileCode2 size={16} />}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: item.color, fontWeight: 'bold' }}>{item.name}</h2>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.category === 'onlyInSource' ? 'Exists only in Source' : 
               item.category === 'onlyInTarget' ? 'Exists only in Target' : 'Differences detected'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="detail-body" style={{ padding: '1rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {item.type === 'tables' ? <TableDetail item={item} /> : <SpDetail item={item} targetInfo={targetInfo} />}
      </div>
    </div>
  );
}

function TableDetail({ item }) {
  if (item.category === 'modified') {
    const diff = item.data;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', height: '100%' }}>
        {diff.columns.onlyInSource.length > 0 && (
          <div>
            <h4 style={{ color: 'var(--success)', marginBottom: '0.35rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{background: 'rgba(16, 185, 129, 0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem'}}>+</span> Missing in Target (Exists only in Source)
            </h4>
            <div className="table-responsive" style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Column</th><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Type</th><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Nullable</th></tr>
                </thead>
                <tbody>
                  {diff.columns.onlyInSource.map(c => (
                    <tr key={c.name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{padding: '0.35rem 0.75rem'}}><strong>{c.name}</strong></td>
                      <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.dataType} {c.maxLength ? `(${c.maxLength})` : ''}</td>
                      <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.isNullable === 'YES' ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {diff.columns.onlyInTarget.length > 0 && (
          <div>
            <h4 style={{ color: 'var(--danger)', marginBottom: '0.35rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{background: 'rgba(239, 68, 68, 0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem'}}>-</span> Missing in Source (Exists only in Target)
            </h4>
            <div className="table-responsive" style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Column</th><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Type</th><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Nullable</th></tr>
                </thead>
                <tbody>
                  {diff.columns.onlyInTarget.map(c => (
                    <tr key={c.name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{padding: '0.35rem 0.75rem'}}><strong>{c.name}</strong></td>
                      <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.dataType} {c.maxLength ? `(${c.maxLength})` : ''}</td>
                      <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.isNullable === 'YES' ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {diff.columns.modified.length > 0 && (
          <div>
            <h4 style={{ color: 'var(--warning)', marginBottom: '0.35rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{background: 'rgba(245, 158, 11, 0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem'}}>~</span> Modified Column Definitions
            </h4>
            <div className="table-responsive" style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <tr><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Column</th><th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Differences</th></tr>
                </thead>
                <tbody>
                  {diff.columns.modified.map(c => (
                    <tr key={c.colName} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{padding: '0.35rem 0.75rem'}}><strong>{c.colName}</strong></td>
                      <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>
                        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                          {c.changes.map((change, i) => <li key={i}>{change}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(diff.keys.pkDifferences || diff.keys.fkDifferences) && (
          <div>
            <h4 style={{ color: 'var(--warning)', marginBottom: '0.35rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{background: 'rgba(245, 158, 11, 0.2)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.7rem'}}>~</span> Key Differences
            </h4>
            <div style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', padding: '0.75rem', fontSize: '0.82rem' }}>
              {diff.keys.pkDifferences && (
                <div style={{ marginBottom: diff.keys.fkDifferences ? '0.75rem' : 0 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Primary Keys:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                    <div><span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Source:</span> <br/>{diff.keys.srcPk.join(', ') || 'None'}</div>
                    <div><span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>Target:</span> <br/>{diff.keys.tgtPk.join(', ') || 'None'}</div>
                  </div>
                </div>
              )}
              {diff.keys.fkDifferences && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Foreign Keys:</strong>
                  <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>Differences detected in foreign key relationships. (Source: {diff.keys.srcFks.length} FKs, Target: {diff.keys.tgtFks.length} FKs)</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Missing table
  const table = item.data;
  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Columns ({table.columns.length})</h4>
      <div className="table-responsive" style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Name</th>
              <th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Type</th>
              <th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Nullable</th>
              <th style={{padding: '0.35rem 0.75rem', textAlign: 'left'}}>Default</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map(c => (
              <tr key={c.name} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{padding: '0.35rem 0.75rem'}}>
                  <strong>{c.name}</strong>
                  {table.primaryKeys.includes(c.name) && <span style={{marginLeft: '6px', fontSize: '0.62rem', background: 'var(--accent)', color: '#fff', padding: '1px 4px', borderRadius: '3px'}}>PK</span>}
                </td>
                <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.dataType} {c.maxLength ? `(${c.maxLength})` : ''}</td>
                <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-secondary)'}}>{c.isNullable === 'YES' ? 'Yes' : 'No'}</td>
                <td style={{padding: '0.35rem 0.75rem', color: 'var(--text-tertiary)', fontFamily: 'monospace'}}>{c.default || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SpDetail({ item, targetInfo }) {
  const [sourceCode, setSourceCode] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Diff Viewer options
  const [splitView, setSplitView] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check if definition is already in item data
    if (item.category === 'modified' && item.data.sourceDefinition && item.data.targetDefinition) {
      setSourceCode(item.data.sourceDefinition);
      setTargetCode(item.data.targetDefinition);
      return;
    }

    const fetchDefinitions = async () => {
      setLoading(true);
      setError(null);
      try {
        let srcCode = item.data.definition || '';
        let tgtCode = '';

        if (!srcCode && (item.category === 'onlyInSource' || item.category === 'modified')) {
          const sp = item.category === 'modified' ? item.data.source : item.data;
          const res = await fetch('/api/compare/sp-definition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sameServer: true,
              schema: sp.schema_name,
              name: sp.sp_name
            })
          });
          const data = await res.json();
          if (res.ok) srcCode = data.definition || '';
        }

        if (item.category === 'onlyInTarget' || item.category === 'modified') {
          const sp = item.category === 'modified' ? item.data.target : item.data;
          const res = await fetch('/api/compare/sp-definition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sameServer: targetInfo?.sameServer ?? true,
              dbName: targetInfo?.dbName,
              targetConfig: targetInfo?.targetConfig,
              schema: sp.schema_name,
              name: sp.sp_name
            })
          });
          const data = await res.json();
          if (res.ok) tgtCode = data.definition || '';
        }

        if (isMounted) {
          setSourceCode(srcCode);
          setTargetCode(tgtCode);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDefinitions();
    return () => { isMounted = false; };
  }, [item, targetInfo]);

  const handleCopy = (text, isSource) => {
    navigator.clipboard.writeText(text);
    if (isSource) {
      setCopiedSource(true);
      setTimeout(() => setCopiedSource(false), 2000);
    } else {
      setCopiedTarget(true);
      setTimeout(() => setCopiedTarget(false), 2000);
    }
  };

  const normalizedSource = useMemo(() => {
    return normalizeSql(sourceCode, { ignoreWhitespace });
  }, [sourceCode, ignoreWhitespace]);

  const normalizedTarget = useMemo(() => {
    return normalizeSql(targetCode, { ignoreWhitespace });
  }, [targetCode, ignoreWhitespace]);

  if (item.category === 'modified') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', minHeight: 0 }}>
        
        {/* Diff Control Toolbar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          background: 'var(--bg-primary)', 
          border: '1px solid var(--border)', 
          borderRadius: '6px', 
          padding: '0.4rem 0.75rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={ignoreWhitespace}
                onChange={(e) => setIgnoreWhitespace(e.target.checked)}
              />
              <span>Ignore Whitespace</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showDiffOnly}
                onChange={(e) => setShowDiffOnly(e.target.checked)}
              />
              <span>Collapse Unchanged Lines</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              className="btn btn-sm"
              onClick={() => setSplitView(!splitView)}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              {splitView ? <Split size={12} /> : <AlignJustify size={12} />}
              {splitView ? 'Split View' : 'Unified View'}
            </button>

            <button
              className="btn btn-sm"
              onClick={() => handleCopy(sourceCode, true)}
              title="Copy Source SP Code"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              {copiedSource ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
              Copy Source
            </button>

            <button
              className="btn btn-sm"
              onClick={() => handleCopy(targetCode, false)}
              title="Copy Target SP Code"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              {copiedTarget ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
              Copy Target
            </button>
          </div>
        </div>
        
        {/* Full-Height Diff Viewer */}
        <div style={{ flex: 1, minHeight: 0, height: '100%', position: 'relative' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <Loader2 className="animate-spin" size={24} color="var(--text-tertiary)" />
            </div>
          ) : error ? (
            <div style={{ padding: '1rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
              Failed to load procedure definitions: {error}
            </div>
          ) : (
            <div className="diff-viewer-wrapper" style={{ height: '100%' }}>
              <div style={{ minWidth: '700px' }}>
                <ReactDiffViewer 
                  oldValue={normalizedSource} 
                  newValue={normalizedTarget} 
                  splitView={splitView} 
                  showDiffOnly={showDiffOnly}
                  compareMethod={DiffMethod.WORDS}
                  leftTitle="Source Server"
                  rightTitle={`Target Server (${targetInfo?.label || 'Target'})`}
                  useDarkTheme={document.body.getAttribute('data-theme') === 'dark'}
                  styles={{
                    variables: {
                      dark: { 
                        diffViewerBackground: 'var(--bg-primary)', 
                        diffViewerColor: 'var(--text-primary)',
                        addedBackground: 'rgba(16, 185, 129, 0.15)',
                        addedColor: '#10b981',
                        removedBackground: 'rgba(239, 68, 68, 0.15)',
                        removedColor: '#ef4444',
                        wordAddedBackground: 'rgba(16, 185, 129, 0.3)',
                        wordRemovedBackground: 'rgba(239, 68, 68, 0.3)'
                      },
                      light: { 
                        diffViewerBackground: '#ffffff', 
                        diffViewerColor: '#0f172a',
                        addedBackground: 'rgba(5, 150, 105, 0.12)',
                        removedBackground: 'rgba(220, 38, 38, 0.12)'
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Missing SP (Only in Source or Target)
  const sp = item.data;
  const isSource = item.category === 'onlyInSource';
  const codeToShow = isSource ? sourceCode : targetCode;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%', minHeight: 0 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        background: 'var(--bg-primary)', 
        border: '1px solid var(--border)', 
        borderRadius: '6px', 
        padding: '0.4rem 0.75rem',
        flexShrink: 0
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Created: <strong>{new Date(sp.create_date).toLocaleDateString()}</strong></span>
          <span style={{ marginLeft: '1rem' }}>Modified: <strong>{new Date(sp.modify_date).toLocaleDateString()}</strong></span>
        </div>

        <button
          className="btn btn-sm"
          onClick={() => handleCopy(codeToShow, isSource)}
          style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          {(isSource ? copiedSource : copiedTarget) ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
          Copy SQL
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <Loader2 className="animate-spin" size={24} color="var(--text-tertiary)" />
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
            Failed to load definition: {error}
          </div>
        ) : (
          <pre style={{ 
            margin: 0, 
            padding: '1rem', 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border)', 
            borderRadius: '6px', 
            overflow: 'auto', 
            height: '100%',
            fontSize: '0.825rem', 
            fontFamily: 'monospace',
            color: isSource ? 'var(--success)' : 'var(--danger)',
            lineHeight: 1.5
          }}>
            {codeToShow || '// No SQL definition available'}
          </pre>
        )}
      </div>
    </div>
  );
}
