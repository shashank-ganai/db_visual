import React, { useState, useEffect } from 'react';
import { X, Loader2, Play, Code, List, SlidersHorizontal, GitBranch, Copy, Check, Sparkles, RefreshCw, AlertTriangle, MessageSquare, Shield, Maximize2, Minimize2, Calendar, Clock } from 'lucide-react';
import { useToast } from './ToastProvider';
import ReactMarkdown from 'react-markdown';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function SpDetailPanel({ 
  selectedSp, 
  onClose,
  theme,
  onOpenAiChat
}) {
  const [activeTab, setActiveTab] = useState('parameters');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const showToast = useToast();

  // 360° Overview state
  const [aiOverview, setAiOverview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiWarnings, setAiWarnings] = useState([]);
  const [overviewCopied, setOverviewCopied] = useState(false);

  useEffect(() => {
    if (selectedSp) {
      setLoading(true);
      setError(null);
      setAnalysis(null);
      setActiveTab('parameters');
      // Reset AI overview when SP changes
      setAiOverview(null);
      setAiError(null);
      setAiWarnings([]);
      
      const { schema_name, sp_name } = selectedSp;
      fetch(`/api/sps/${schema_name}/${sp_name}/analyze`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setAnalysis(data);
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [selectedSp]);

  const generateOverview = async () => {
    const apiKey = localStorage.getItem('openrouter_key');
    const model = localStorage.getItem('openrouter_model') || 'openai/gpt-4o-mini';

    if (!apiKey) {
      setAiError('No OpenRouter API key configured. Please open the AI Assistant (chat icon in toolbar) and configure your API key in Settings first.');
      return;
    }

    if (!analysis) {
      setAiError('SP analysis data not loaded yet. Please wait or try again.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiWarnings([]);
    setAiOverview(null);

    try {
      const response = await fetch('/api/ai/analyze-sp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spMetadata: {
            schema: selectedSp.schema_name,
            name: selectedSp.sp_name,
            definition: analysis.definition,
            parameters: analysis.parameters,
            outputColumns: analysis.outputColumns,
            dependsOn: analysis.dependsOn,
            referencedBy: analysis.referencedBy
          },
          model,
          apiKey
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        throw new Error(`Server returned invalid JSON (Status: ${response.status}). Body: ${responseText.substring(0, 50)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate overview (Status: ${response.status})`);
      }

      setAiOverview(data.content);
      if (data.warnings && data.warnings.length > 0) {
        setAiWarnings(data.warnings);
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const copyOverview = () => {
    if (aiOverview) {
      navigator.clipboard.writeText(aiOverview);
      setOverviewCopied(true);
      showToast('360° Overview copied to clipboard');
      setTimeout(() => setOverviewCopied(false), 2000);
    }
  };

  const [isMaximized, setIsMaximized] = useState(false);

  if (!selectedSp) return null;

  const spCreateDate = selectedSp.create_date || analysis?.createDate;
  const spModifyDate = selectedSp.modify_date || analysis?.modifyDate;

  return (
    <div className={`detail-panel ${selectedSp ? 'open' : ''} ${isMaximized ? 'maximized' : ''}`} style={!isMaximized ? { width: '550px' } : {}}>
      <div className="detail-header">
        <div className="detail-title">
          <h2>{selectedSp.sp_name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
            <span>{selectedSp.schema_name} (Stored Procedure)</span>
            {spCreateDate && (
              <span className="metadata-date-badge" title={`Created: ${new Date(spCreateDate).toLocaleString()}`}>
                <Calendar size={11} />
                Created: {new Date(spCreateDate).toLocaleDateString()}
              </span>
            )}
            {spModifyDate && (
              <span className="metadata-date-badge" title={`Last Modified: ${new Date(spModifyDate).toLocaleString()}`}>
                <Clock size={11} />
                Updated: {new Date(spModifyDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="detail-header-actions">
          <button 
            className="btn-icon" 
            onClick={() => setIsMaximized(!isMaximized)} 
            title={isMaximized ? "Restore standard size" : "Maximize panel"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button className="btn-icon" onClick={onClose} title="Close panel">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        <button 
          className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Sparkles size={14} style={{marginRight: '6px'}} /> 360° Overview
        </button>
        <button 
          className={`detail-tab ${activeTab === 'parameters' ? 'active' : ''}`}
          onClick={() => setActiveTab('parameters')}
        >
          <SlidersHorizontal size={14} style={{marginRight: '6px'}} /> Parameters
        </button>
        <button 
          className={`detail-tab ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => setActiveTab('output')}
        >
          <Play size={14} style={{marginRight: '6px'}} /> Output Schema
        </button>
        <button 
          className={`detail-tab ${activeTab === 'code' ? 'active' : ''}`}
          onClick={() => setActiveTab('code')}
        >
          <Code size={14} style={{marginRight: '6px'}} /> Definition
        </button>
        <button 
          className={`detail-tab ${activeTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          <GitBranch size={14} style={{marginRight: '6px'}} /> Dependencies
        </button>
      </div>

      <div className="detail-content">
        {loading && (
          <div style={{display:'flex', justifyContent:'center', padding:'2rem', color:'var(--accent)'}}>
            <Loader2 className="animate-spin" />
          </div>
        )}
        
        {error && (
          <div className="error-message">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* ===== 360° OVERVIEW TAB ===== */}
            {activeTab === 'overview' && (
              <div className="overview-tab-content">
                {!aiOverview && !aiLoading && !aiError && (
                  <div className="overview-empty-state">
                    <div className="overview-icon-wrapper">
                      <Sparkles size={36} />
                    </div>
                    <h3>360° AI Analysis</h3>
                    <p>Generate a comprehensive analysis of this stored procedure including purpose, data flow, security audit, performance observations, and change impact assessment.</p>
                    <div className="overview-security-badge">
                      <Shield size={14} />
                      <span>Read-only analysis — no modifications will be suggested</span>
                    </div>
                    <button 
                      className="btn btn-primary overview-generate-btn" 
                      onClick={generateOverview}
                      disabled={!analysis}
                    >
                      <Sparkles size={16} /> Generate 360° Overview
                    </button>
                  </div>
                )}

                {aiLoading && (
                  <div className="overview-loading">
                    <Loader2 size={28} className="animate-spin" />
                    <p>Analyzing stored procedure...</p>
                    <span>This may take 10-30 seconds depending on complexity</span>
                  </div>
                )}

                {aiError && (
                  <div style={{padding: '1rem'}}>
                    <div className="error-message">{aiError}</div>
                    <button 
                      className="btn btn-primary" 
                      onClick={generateOverview}
                      style={{marginTop: '1rem'}}
                    >
                      <RefreshCw size={14} /> Try Again
                    </button>
                  </div>
                )}

                {aiWarnings.length > 0 && (
                  <div className="overview-warnings">
                    {aiWarnings.map((w, i) => (
                      <div key={i} className="overview-warning-item">
                        <AlertTriangle size={14} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {aiOverview && (
                  <div className="overview-result">
                    <div className="overview-toolbar">
                      <button 
                        className="btn-icon-text" 
                        onClick={copyOverview}
                        title="Copy full report"
                      >
                        {overviewCopied ? <Check size={14} /> : <Copy size={14} />}
                        {overviewCopied ? 'Copied' : 'Copy'}
                      </button>
                      <button 
                        className="btn-icon-text" 
                        onClick={generateOverview}
                        title="Regenerate analysis"
                      >
                        <RefreshCw size={14} /> Regenerate
                      </button>
                    </div>
                    <div className="overview-markdown-body">
                      <ReactMarkdown>{aiOverview}</ReactMarkdown>
                    </div>
                    
                    {/* Quick-action suggestion pills */}
                    <div className="overview-quick-actions">
                      <p className="quick-actions-label">Ask follow-up questions:</p>
                      <div className="quick-actions-pills">
                        {analysis?.dependsOn?.filter(d => d.type === 'OBJECT_OR_COLUMN').slice(0, 2).map((dep, i) => (
                          <button 
                            key={i}
                            className="suggestion-pill" 
                            onClick={() => {
                              if (onOpenAiChat) onOpenAiChat(`What happens if I add a column to ${dep.schema_name}.${dep.entity_name}?`);
                            }}
                          >
                            <Sparkles size={12} style={{marginRight:'4px'}}/> Impact on {dep.entity_name}?
                          </button>
                        ))}
                        <button 
                          className="suggestion-pill" 
                          onClick={() => {
                            if (onOpenAiChat) onOpenAiChat(`Is there a SQL injection risk in the stored procedure ${selectedSp.schema_name}.${selectedSp.sp_name}? Analyze its use of dynamic SQL.`);
                          }}
                        >
                          <Sparkles size={12} style={{marginRight:'4px'}}/> SQL injection risk?
                        </button>
                        <button 
                          className="suggestion-pill" 
                          onClick={() => {
                            if (onOpenAiChat) onOpenAiChat(`What indexes would improve the performance of ${selectedSp.schema_name}.${selectedSp.sp_name}? Analyze its query patterns.`);
                          }}
                        >
                          <Sparkles size={12} style={{marginRight:'4px'}}/> Suggest indexes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== PARAMETERS TAB ===== */}
            {activeTab === 'parameters' && analysis && (
              <>
                {analysis.parameters.length === 0 ? (
                  <p style={{fontSize:'0.875rem', color:'var(--text-tertiary)', padding: '1rem'}}>This stored procedure takes no parameters.</p>
                ) : (
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Parameter Name</th>
                        <th>Data Type</th>
                        <th>Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.parameters.map((p, i) => (
                        <tr key={i}>
                          <td style={{color: 'var(--text-primary)'}}>{p.ParameterName}</td>
                          <td>
                            {p.DataType}
                            {p.MaxLength > 0 && `(${p.MaxLength})`}
                            {p.MaxLength === -1 && '(max)'}
                          </td>
                          <td>
                            {p.IsOutput ? <span className="badge badge-output">OUTPUT</span> : <span className="badge badge-input">INPUT</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* ===== OUTPUT SCHEMA TAB ===== */}
            {activeTab === 'output' && analysis && (
              <div className="rel-section">
                <h3>Predicted Output Columns</h3>
                <p style={{fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1rem'}}>
                  Determined safely via dry-run metadata analysis. No data was altered.
                </p>
                {analysis.outputColumns.length === 0 ? (
                  <div style={{padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'}}>
                    <p style={{fontSize:'0.875rem', color:'var(--text-secondary)'}}>No output schema could be determined.</p>
                    <p style={{fontSize:'0.75rem', color:'var(--text-tertiary)', marginTop: '0.5rem'}}>This usually happens if the SP uses temporary tables, dynamic SQL, or performs operations that don't return a result set.</p>
                  </div>
                ) : (
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Column Name</th>
                        <th>System Type</th>
                        <th>Nullable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.outputColumns.map((col, i) => (
                        <tr key={i}>
                          <td style={{color: 'var(--text-primary)'}}>{col.name}</td>
                          <td>{col.system_type_name}</td>
                          <td>{col.is_nullable ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ===== DEFINITION TAB ===== */}
            {activeTab === 'code' && analysis && (
              <div className="sp-code-container" style={{ padding: '0', height: '100%', overflow: 'hidden' }}>
                 <button 
                   className="copy-btn" 
                   onClick={() => {
                     navigator.clipboard.writeText(analysis.definition);
                     setCopied(true);
                     showToast('Code copied to clipboard');
                     setTimeout(() => setCopied(false), 2000);
                   }}
                 >
                   {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                 </button>
                 <pre style={{ 
                   margin: 0, 
                   padding: '2.5rem 1rem 1rem 1rem', 
                   background: 'var(--bg-tertiary)', 
                   color: 'var(--text-primary)', 
                   fontSize: '0.8rem', 
                   overflow: 'auto',
                   height: '100%',
                   fontFamily: 'monospace'
                 }}>
                   {analysis.definition}
                 </pre>
              </div>
            )}

            {/* ===== DEPENDENCIES TAB ===== */}
            {activeTab === 'dependencies' && analysis && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                <div className="rel-section">
                  <h3>Depends On (Outgoing)</h3>
                  <p style={{fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1rem'}}>
                    Tables, Views, and Functions this SP queries.
                  </p>
                  {analysis.dependsOn && analysis.dependsOn.length > 0 ? (
                    analysis.dependsOn.map((dep, i) => (
                      <div key={i} className="rel-item">
                        <div className="rel-item-details">
                          <div className="rel-item-table">{dep.schema_name}.{dep.entity_name}</div>
                          <div className="rel-item-columns">{dep.type}</div>
                        </div>
                      </div>
                    ))
                  ) : <p style={{color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No dependencies found.</p>}
                </div>

                <div className="rel-section">
                  <h3>Referenced By (Incoming)</h3>
                  <p style={{fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1rem'}}>
                    Other SPs or Triggers that execute this SP.
                  </p>
                  {analysis.referencedBy && analysis.referencedBy.length > 0 ? (
                    analysis.referencedBy.map((dep, i) => (
                      <div key={i} className="rel-item">
                        <div className="rel-item-details">
                          <div className="rel-item-table">{dep.schema_name}.{dep.entity_name}</div>
                          <div className="rel-item-columns">{dep.type}</div>
                        </div>
                      </div>
                    ))
                  ) : <p style={{color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No incoming references.</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
