import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  X, Loader2, ArrowRight, List, GitBranch, KeyRound, Key, Table2, Network, 
  Maximize2, Minimize2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  RefreshCw, Download, Search, Database, Layers, Calendar, Clock
} from 'lucide-react';
import { useToast } from './ToastProvider';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export default function DetailPanel({ 
  schemaData, 
  selectedTableId, 
  onClose,
  onSelectTable,
  selectedColumn,
  onSelectColumn,
  theme
}) {
  const [activeTab, setActiveTab] = useState('columns');
  const [isMaximized, setIsMaximized] = useState(false);
  const showToast = useToast();
  const gridRef = useRef(null);
  
  // Data Tab State
  const [tableData, setTableData] = useState([]);
  const [dataColumns, setDataColumns] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [dataFetchedTable, setDataFetchedTable] = useState(null);
  const [dependencies, setDependencies] = useState(null);

  // Pagination & Scroll State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [quickFilterText, setQuickFilterText] = useState('');
  
  // Find table from schema
  const table = useMemo(() => {
    if (!schemaData || !selectedTableId) return null;
    return schemaData.tables.find(t => `${t.schema}.${t.name}` === selectedTableId);
  }, [schemaData, selectedTableId]);

  // Fetch Table Data
  const fetchData = useCallback((page = 1, size = 50, append = false) => {
    if (!table) return;
    setDataLoading(true);
    setDataError(null);

    fetch(`/api/table/${table.schema}/${table.name}/data?page=${page}&size=${size}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        
        const rows = data.rows || [];
        if (append) {
          setTableData(prev => [...prev, ...rows]);
        } else {
          setTableData(rows);
        }

        if (data.columns && data.columns.length > 0) {
          setDataColumns(
            data.columns.map(col => ({
              field: col,
              sortable: true,
              filter: true,
              resizable: true,
              minWidth: 120
            }))
          );
        }

        const total = data.totalRows !== undefined ? data.totalRows : (table.rowCount || rows.length);
        setTotalRows(total);
        const pages = Math.max(1, Math.ceil(total / size));
        setTotalPages(pages);
        setCurrentPage(page);
        setPageInput(String(page));
        setDataFetchedTable(selectedTableId);
      })
      .catch(err => setDataError(err.message))
      .finally(() => setDataLoading(false));
  }, [table, selectedTableId]);

  // Fetch data when tab becomes data
  useEffect(() => {
    if (activeTab === 'data' && table && dataFetchedTable !== selectedTableId) {
      setCurrentPage(1);
      setPageInput('1');
      fetchData(1, pageSize, false);
    }
  }, [activeTab, table, selectedTableId, dataFetchedTable, pageSize, fetchData]);

  // Fetch dependencies when tab is dependencies
  useEffect(() => {
    if (activeTab === 'dependencies' && table && !dependencies) {
      fetch(`/api/tables/${table.schema}/${table.name}/dependencies`)
        .then(res => res.json())
        .then(data => setDependencies(data))
        .catch(err => console.error("Failed to load deps:", err));
    }
  }, [activeTab, table, dependencies]);

  // Reset state when table selection changes
  useEffect(() => {
    setActiveTab('columns');
    setDependencies(null);
    setDataFetchedTable(null);
    setTableData([]);
    setCurrentPage(1);
    setPageInput('1');
    setQuickFilterText('');
  }, [selectedTableId]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    fetchData(newPage, pageSize, false);
  };

  const handlePageSizeChange = (newSize) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setCurrentPage(1);
    setPageInput('1');
    fetchData(1, size, false);
  };

  const handlePageInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(pageInput, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
        handlePageChange(parsed);
      } else {
        setPageInput(String(currentPage));
      }
    }
  };

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    if (nextPage <= totalPages) {
      fetchData(nextPage, pageSize, true);
      setCurrentPage(nextPage);
      setPageInput(String(nextPage));
      showToast(`Loaded page ${nextPage} (${pageSize} more rows)`);
    } else {
      showToast('All available pages have been loaded.');
    }
  };

  const handleExportCsv = () => {
    if (gridRef.current && gridRef.current.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${table.schema}_${table.name}_data.csv`
      });
      showToast('Exported table data to CSV');
    } else if (tableData.length > 0) {
      // Fallback CSV export
      const headers = Object.keys(tableData[0]).join(',');
      const rows = tableData.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${table.schema}_${table.name}_data.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported table data to CSV');
    }
  };

  if (!table) return null;

  // Find relationships
  const outgoing = table.foreignKeys;
  const incoming = schemaData.tables.flatMap(t => 
    (t.foreignKeys || [])
      .filter(fk => fk.referencedSchema === table.schema && fk.referencedTable === table.name)
      .map(fk => ({
        ...fk,
        sourceSchema: t.schema,
        sourceTable: t.name
      }))
  );

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(startRecord + tableData.length - 1, totalRows || tableData.length);

  return (
    <div className={`detail-panel ${selectedTableId ? 'open' : ''} ${isMaximized ? 'maximized' : ''}`}>
      <div className="detail-header">
        <div className="detail-title">
          <h2>{table.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
            <span>{table.schema}</span>
            {table.rowCount !== undefined && (
              <span className="row-count-badge" title="Estimated database row count">
                <Database size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                {table.rowCount.toLocaleString()} rows
              </span>
            )}
            {table.createDate && (
              <span className="metadata-date-badge" title={`Created: ${new Date(table.createDate).toLocaleString()}`}>
                <Calendar size={11} />
                Created: {new Date(table.createDate).toLocaleDateString()}
              </span>
            )}
            {table.modifyDate && (
              <span className="metadata-date-badge" title={`Last Modified: ${new Date(table.modifyDate).toLocaleString()}`}>
                <Clock size={11} />
                Updated: {new Date(table.modifyDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="detail-header-actions">
          <button 
            className="btn-icon" 
            onClick={() => setIsMaximized(!isMaximized)} 
            title={isMaximized ? "Restore standard size" : "Maximize window"}
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
          className={`detail-tab ${activeTab === 'columns' ? 'active' : ''}`}
          onClick={() => setActiveTab('columns')}
        >
          <List size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Columns ({table.columns.length})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'relationships' ? 'active' : ''}`}
          onClick={() => setActiveTab('relationships')}
        >
          <GitBranch size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Relations ({outgoing.length + incoming.length})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'indexes' ? 'active' : ''}`}
          onClick={() => setActiveTab('indexes')}
        >
          <KeyRound size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Indexes ({table.indexes.length})
        </button>
        <button 
          className={`detail-tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <Table2 size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Data
        </button>
        <button 
          className={`detail-tab ${activeTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          <Network size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Dependencies
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'columns' && (
          <>
            {(table.createDate || table.modifyDate) && (
              <div className="table-metadata-banner">
                {table.createDate && (
                  <div className="meta-item">
                    <span className="meta-label">Created:</span>
                    <span className="meta-value">{new Date(table.createDate).toLocaleString()}</span>
                  </div>
                )}
                {table.modifyDate && (
                  <div className="meta-item">
                    <span className="meta-label">Last Modified:</span>
                    <span className="meta-value">{new Date(table.modifyDate).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
            <table className="detail-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Type</th>
                <th>Nullable</th>
                <th style={{ width: '40px', textAlign: 'center' }}>Key</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map(col => {
                const isColMatch = Boolean(
                  selectedColumn && 
                  selectedColumn.toLowerCase() === col.name.toLowerCase()
                );

                return (
                  <tr key={col.name} className={isColMatch ? 'row-highlight-orange' : ''}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {col.isPrimaryKey && <span className="badge pk" title="Primary Key">PK</span>}
                        {col.isForeignKey && <span className="badge fk" title="Foreign Key">FK</span>}
                        <span 
                          style={{
                            fontWeight: isColMatch ? 700 : 500, 
                            color: isColMatch ? '#f97316' : 'var(--text-primary)', 
                            cursor: 'pointer'
                          }} 
                          title={`Click to toggle orange highlight for key "${col.name}" across all tables`}
                          onClick={() => {
                            if (onSelectColumn) {
                              onSelectColumn(isColMatch ? null : col.name);
                              showToast(isColMatch ? `Cleared key highlight` : `Highlighting tables containing "${col.name}" in orange`);
                            }
                          }}
                        >
                          {col.name}
                        </span>
                        {isColMatch && (
                          <span className="key-match-badge" style={{ marginLeft: '4px' }}>Active</span>
                        )}
                      </div>
                    </td>
                    <td>{col.dataType}</td>
                    <td>{col.isNullable ? 'Yes' : 'No'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-icon"
                        style={{ 
                          padding: '3px', 
                          color: isColMatch ? '#f97316' : 'var(--text-tertiary)',
                          background: isColMatch ? 'rgba(249, 115, 22, 0.15)' : 'transparent'
                        }}
                        onClick={() => {
                          if (onSelectColumn) {
                            onSelectColumn(isColMatch ? null : col.name);
                            showToast(isColMatch ? `Cleared key highlight` : `Highlighting tables containing "${col.name}" in orange`);
                          }
                        }}
                        title={isColMatch ? "Clear key highlight" : `Highlight all tables with "${col.name}" in orange`}
                      >
                        <Key size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}

        {activeTab === 'relationships' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <div className="rel-section">
              <h3>Outgoing Foreign Keys</h3>
              {outgoing && outgoing.length > 0 ? (
                outgoing.map((fk, i) => (
                  <div key={i} className="rel-item" onClick={() => onSelectTable(`${fk.referencedSchema}.${fk.referencedTable}`)}>
                    <div className="rel-item-details">
                      <div className="rel-item-table">{fk.referencedSchema}.{fk.referencedTable}</div>
                      <div className="rel-item-columns">{fk.column} <ArrowRight size={12} style={{display:'inline', verticalAlign:'middle'}}/> {fk.referencedColumn}</div>
                    </div>
                  </div>
                ))
              ) : <p style={{color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No outgoing relationships.</p>}
            </div>

            <div className="rel-section">
              <h3>Incoming Foreign Keys</h3>
              {incoming.length > 0 ? (
                incoming.map((fk, i) => (
                  <div key={i} className="rel-item" onClick={() => onSelectTable(`${fk.sourceSchema}.${fk.sourceTable}`)}>
                    <div className="rel-item-details">
                      <div className="rel-item-table">{fk.sourceSchema}.{fk.sourceTable}</div>
                      <div className="rel-item-columns">{fk.column} <ArrowRight size={12} style={{display:'inline', verticalAlign:'middle'}}/> {fk.referencedColumn}</div>
                    </div>
                  </div>
                ))
              ) : <p style={{color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No incoming relationships.</p>}
            </div>
          </div>
        )}

        {activeTab === 'indexes' && (
          <div className="rel-section">
            {table.indexes.length === 0 ? <p style={{fontSize:'0.875rem', color:'var(--text-tertiary)'}}>No indexes found</p> : null}
            {table.indexes.map(idx => (
              <div key={idx.name} style={{marginBottom: '1rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'}}>
                <div style={{fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.875rem'}}>{idx.name}</div>
                <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>
                  {idx.type} {idx.isUnique ? ' • Unique' : ''}
                </div>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  {idx.columns.map(c => (
                    <span key={c} style={{background: 'var(--bg-secondary)', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border)'}}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="data-tab-container">
            {/* Top Toolbar */}
            <div className="data-toolbar">
              <div className="data-toolbar-left">
                <div className="data-search-box">
                  <Search size={14} className="data-search-icon" />
                  <input
                    type="text"
                    placeholder="Quick search loaded rows..."
                    value={quickFilterText}
                    onChange={(e) => setQuickFilterText(e.target.value)}
                  />
                  {quickFilterText && (
                    <button className="data-search-clear" onClick={() => setQuickFilterText('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="data-size-selector">
                  <span className="data-control-label">Rows per page:</span>
                  <select 
                    value={pageSize} 
                    onChange={(e) => handlePageSizeChange(e.target.value)}
                    disabled={dataLoading}
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="250">250</option>
                    <option value="500">500</option>
                    <option value="1000">1,000</option>
                  </select>
                </div>
              </div>

              <div className="data-toolbar-right">
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={handleExportCsv}
                  title="Export current table data as CSV"
                  disabled={tableData.length === 0}
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>

                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => fetchData(currentPage, pageSize, false)}
                  title="Refresh current page"
                  disabled={dataLoading}
                >
                  <RefreshCw size={13} className={dataLoading ? "animate-spin" : ""} />
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? "Restore standard size" : "Maximize data view"}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
            </div>

            {/* Main Table Grid Area */}
            <div className="data-grid-wrapper">
              {dataLoading && (
                <div className="data-loading-overlay">
                  <Loader2 className="animate-spin" size={28} />
                  <span>Loading data...</span>
                </div>
              )}
              {dataError && (
                <div className="error-message" style={{ margin: '1rem' }}>{dataError}</div>
              )}
              {!dataError && (
                <div className={`ag-theme-alpine${theme === 'dark' ? '-dark' : ''} data-grid-instance`}>
                  <AgGridReact
                    ref={gridRef}
                    rowData={tableData}
                    columnDefs={dataColumns}
                    pagination={false}
                    quickFilterText={quickFilterText}
                    domLayout="normal"
                    defaultColDef={{
                      sortable: true,
                      filter: true,
                      resizable: true,
                      minWidth: 100
                    }}
                    enableCellTextSelection={true}
                    suppressRowClickSelection={true}
                  />
                </div>
              )}
            </div>

            {/* Bottom Pagination & Scroll Controls */}
            <div className="data-pagination-bar">
              <div className="pagination-info">
                {totalRows > 0 ? (
                  <span>
                    Showing <strong>{startRecord}</strong> - <strong>{endRecord}</strong> of <strong>{totalRows.toLocaleString()}</strong> rows
                    {tableData.length > (endRecord - startRecord + 1) && ` (${tableData.length} loaded)`}
                  </span>
                ) : (
                  <span>{tableData.length} rows loaded</span>
                )}
              </div>

              <div className="pagination-controls">
                <button 
                  className="btn-pagination" 
                  onClick={() => handlePageChange(1)} 
                  disabled={currentPage <= 1 || dataLoading}
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button 
                  className="btn-pagination" 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage <= 1 || dataLoading}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="pagination-jump">
                  <span>Page</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={handlePageInputSubmit}
                    onBlur={() => setPageInput(String(currentPage))}
                    disabled={dataLoading}
                  />
                  <span>of {totalPages.toLocaleString()}</span>
                </div>

                <button 
                  className="btn-pagination" 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage >= totalPages || dataLoading}
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
                <button 
                  className="btn-pagination" 
                  onClick={() => handlePageChange(totalPages)} 
                  disabled={currentPage >= totalPages || dataLoading}
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>

                {currentPage < totalPages && (
                  <button 
                    className="btn btn-secondary btn-sm load-more-btn"
                    onClick={handleLoadMore}
                    disabled={dataLoading}
                    title="Append next page of data without replacing current view (scroll all data)"
                  >
                    <Layers size={13} />
                    <span>Load More (+{pageSize})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="rel-section">
            <h3>Dependencies (Referenced By)</h3>
            <p style={{fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '1rem'}}>
              Other database objects (Views, SPs, Triggers) that depend on this table.
            </p>
            {dependencies && dependencies.length > 0 ? (
              dependencies.map((dep, i) => (
                <div key={i} className="rel-item">
                  <div className="rel-item-details">
                    <div className="rel-item-table">{dep.schema_name}.{dep.entity_name}</div>
                    <div className="rel-item-columns">{dep.type}</div>
                  </div>
                </div>
              ))
            ) : <p style={{color: 'var(--text-tertiary)', fontSize: '0.875rem'}}>No dependencies found.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
