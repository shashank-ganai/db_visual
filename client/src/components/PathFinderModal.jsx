import React, { useState, useMemo, useEffect } from 'react';
import { 
  Compass, ArrowRight, Copy, Check, X, Layers, Database, Sparkles, 
  RefreshCw, ArrowRightLeft, Route
} from 'lucide-react';
import { usePathFinder } from '../hooks/usePathFinder';
import { useToast } from './ToastProvider';

export default function PathFinderModal({
  isOpen,
  onClose,
  schemaData,
  onApplyPathToCanvas,
  onClearCanvasPath,
  initialStartTable,
  initialTargetTable
}) {
  const showToast = useToast();
  const { findPath } = usePathFinder(schemaData);

  const [startTable, setStartTable] = useState(initialStartTable || '');
  const [targetTable, setTargetTable] = useState(initialTargetTable || '');
  const [copied, setCopied] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (initialStartTable) setStartTable(initialStartTable);
    if (initialTargetTable) setTargetTable(initialTargetTable);
  }, [initialStartTable, initialTargetTable]);

  const allTables = useMemo(() => {
    if (!schemaData?.tables) return [];
    return [...schemaData.tables].sort((a, b) => a.name.localeCompare(b.name));
  }, [schemaData]);

  // Compute path whenever startTable or targetTable changes
  const pathResult = useMemo(() => {
    if (!startTable || !targetTable) return null;
    return findPath(startTable, targetTable);
  }, [startTable, targetTable, findPath]);

  // Notify canvas of the active path
  useEffect(() => {
    if (pathResult && pathResult.found) {
      onApplyPathToCanvas?.(pathResult);
    } else {
      onClearCanvasPath?.();
    }
  }, [pathResult, onApplyPathToCanvas, onClearCanvasPath]);

  const handleCopySql = () => {
    if (pathResult?.sql) {
      navigator.clipboard.writeText(pathResult.sql);
      setCopied(true);
      showToast('Generated SQL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSwap = () => {
    const temp = startTable;
    setStartTable(targetTable);
    setTargetTable(temp);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pathfinder-modal-card glass" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '7px', borderRadius: '7px', color: 'var(--primary)' }}>
              <Route size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Relationship Path Finder & JOIN Generator</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Trace foreign key routes across tables and generate SQL queries</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Table Selectors */}
        <div style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
              Start Table (Source)
            </label>
            <select
              value={startTable}
              onChange={(e) => setStartTable(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <option value="">-- Select Source Table --</option>
              {allTables.map(t => {
                const id = `${t.schema}.${t.name}`;
                return (
                  <option key={id} value={id}>
                    {t.schema}.{t.name} ({t.columns.length} cols)
                  </option>
                );
              })}
            </select>
          </div>

          <button 
            className="btn-icon" 
            onClick={handleSwap}
            title="Swap Source and Target"
            disabled={!startTable && !targetTable}
            style={{ marginTop: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
          >
            <ArrowRightLeft size={16} />
          </button>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>
              Target Table (Destination)
            </label>
            <select
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}
            >
              <option value="">-- Select Destination Table --</option>
              {allTables.map(t => {
                const id = `${t.schema}.${t.name}`;
                return (
                  <option key={id} value={id}>
                    {t.schema}.{t.name} ({t.columns.length} cols)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Results Area */}
        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!startTable || !targetTable ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', padding: '2rem', textAlign: 'center' }}>
              <Database size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select both a <strong>Source</strong> and <strong>Destination</strong> table to calculate the relationship route.</p>
            </div>
          ) : pathResult && !pathResult.found ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600, marginBottom: '0.75rem' }}>
                No Direct FK Path Found
              </span>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', maxWidth: '460px', lineHeight: 1.5 }}>
                There is no direct or indirect Foreign Key relationship connecting <strong>{startTable}</strong> to <strong>{targetTable}</strong>.
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', maxWidth: '400px' }}>
                They may connect through application logic or implicit keys rather than explicit SQL Server FK constraints.
              </span>
            </div>
          ) : pathResult && pathResult.found ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Path Hop Flow Card */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Relationship Chain ({pathResult.path.length} tables &bull; {pathResult.steps.length} {pathResult.steps.length === 1 ? 'hop' : 'hops'})
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    ● Highlighted on Canvas
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem 0' }}>
                  {pathResult.path.map((tableId, idx) => {
                    const isLast = idx === pathResult.path.length - 1;
                    const step = pathResult.steps[idx];

                    return (
                      <React.Fragment key={tableId}>
                        <div style={{ padding: '0.4rem 0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{tableId.split('.')[1]}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{tableId.split('.')[0]}</span>
                        </div>
                        
                        {!isLast && step && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '0.65rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)', fontFamily: 'monospace' }}>
                              {step.fk?.parentColumn} → {step.fk?.referencedColumn}
                            </div>
                            <ArrowRight size={14} color="var(--accent)" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Generated SQL Code Box */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 1rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Sparkles size={14} color="var(--accent)" />
                    <span>Auto-Generated SQL Query</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCopySql} style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '1rem', background: 'var(--bg-primary)', overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-primary)', maxHeight: '200px', lineHeight: 1.5 }}>
                  <code>{pathResult.sql}</code>
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          <span>💡 <strong>Tip:</strong> The active route is highlighted in violet on the schema canvas in the background.</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '0.35rem 0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
