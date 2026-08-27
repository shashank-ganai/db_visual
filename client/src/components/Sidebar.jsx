import React, { useState, useMemo } from 'react';
import { 
  Search, ChevronDown, ChevronRight, Layers, LayoutList, 
  Database, Code, FileQuestion, ShieldCheck, X, Table2
} from 'lucide-react';
import { EmptyState } from './LoadingStates';
import SchemaHealth from './SchemaHealth';

export default function Sidebar({ 
  schemaData, 
  spsData,
  selectedTable, 
  onSelectTable, 
  selectedColumn, 
  onSelectColumn,
  selectedSp,
  onSelectSp
}) {
  const [activeTab, setActiveTab] = useState('tables'); // 'tables', 'sps', or 'health'
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedSchemas, setCollapsedSchemas] = useState({});

  const totalTables = schemaData?.tables?.length || 0;
  const totalSps = spsData?.length || 0;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const groupedTables = useMemo(() => {
    if (!schemaData || !schemaData.tables) return {};
    
    const groups = {};
    schemaData.tables.forEach(table => {
      let matches = true;
      let matchedColumns = [];
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const tableMatches = table.name.toLowerCase().includes(term);
        matchedColumns = table.columns.filter(c => c.name.toLowerCase().includes(term));
        
        matches = tableMatches || matchedColumns.length > 0;
      }
      
      if (matches) {
        if (!groups[table.schema]) {
          groups[table.schema] = [];
        }
        groups[table.schema].push({ ...table, matchedColumns });
      }
    });
    
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(schema => {
      sortedGroups[schema] = groups[schema].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return sortedGroups;
  }, [schemaData, searchTerm]);

  const groupedSps = useMemo(() => {
    if (!spsData) return {};
    
    const groups = {};
    spsData.forEach(sp => {
      if (searchTerm && !sp.sp_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }
      
      if (!groups[sp.schema_name]) {
        groups[sp.schema_name] = [];
      }
      groups[sp.schema_name].push(sp);
    });
    
    return groups;
  }, [spsData, searchTerm]);

  const toggleSchema = (schema) => {
    setCollapsedSchemas(prev => ({
      ...prev,
      [schema]: !prev[schema]
    }));
  };

  const renderHighlighted = (text, highlight) => {
    if (!highlight) return <span className="entity-name" title={text}>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span className="entity-name" title={text}>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
            ? <span key={i} className="highlight-match">{part}</span> 
            : part
        )}
      </span>
    );
  };

  return (
    <aside className="sidebar">
      {/* Top Segmented Tabs */}
      <div className="sidebar-tab-bar">
        <button 
          className={`sidebar-tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => handleTabChange('tables')}
        >
          <Database size={13} />
          <span>Tables</span>
          {totalTables > 0 && <span className="tab-count-pill">{totalTables}</span>}
        </button>
        
        <button 
          className={`sidebar-tab-btn ${activeTab === 'sps' ? 'active' : ''}`}
          onClick={() => handleTabChange('sps')}
        >
          <Code size={13} />
          <span>SPs</span>
          {totalSps > 0 && <span className="tab-count-pill">{totalSps}</span>}
        </button>
        
        <button 
          className={`sidebar-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => handleTabChange('health')}
          title="Database Schema Health & Linter"
        >
          <ShieldCheck size={13} />
          <span>Health</span>
        </button>
      </div>

      {/* Search Bar */}
      {activeTab !== 'health' && (
        <div className="sidebar-search-container">
          <div className="sidebar-search-box">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder={activeTab === 'tables' ? "Search tables, columns..." : "Search procedures..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sidebar-search-input"
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')} title="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Tree Content Area */}
      <div className="sidebar-content custom-scrollbar">
        {activeTab === 'health' && (
          <SchemaHealth 
            schemaData={schemaData} 
            onSelectTable={onSelectTable} 
          />
        )}

        {activeTab === 'tables' && Object.entries(groupedTables).map(([schema, tables]) => (
          <div key={schema} className="schema-tree-group">
            <div 
              className="schema-group-header" 
              onClick={() => toggleSchema(`tbl_${schema}`)}
            >
              <div className="schema-header-left">
                {collapsedSchemas[`tbl_${schema}`] ? <ChevronRight size={13} className="chevron" /> : <ChevronDown size={13} className="chevron" />}
                <Layers size={13} className="schema-icon" />
                <span className="schema-name">{schema}</span>
              </div>
              <span className="schema-item-count">{tables.length}</span>
            </div>
            
            {!collapsedSchemas[`tbl_${schema}`] && (
              <div className="schema-table-list">
                {tables.map(table => {
                  const id = `${table.schema}.${table.name}`;
                  const isActive = selectedTable === id;
                  
                  return (
                    <div key={id} className="table-item-wrapper">
                      <div 
                        className={`table-list-row ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectTable(id)}
                        title={`${table.schema}.${table.name}\nColumns: ${table.columns.length}\nRows: ${(table.rowCount || 0).toLocaleString()}${table.createDate ? `\nCreated: ${new Date(table.createDate).toLocaleString()}` : ''}${table.modifyDate ? `\nUpdated: ${new Date(table.modifyDate).toLocaleString()}` : ''}`}
                      >
                        <div className="table-row-left">
                          <Table2 size={13} className="table-icon" />
                          {renderHighlighted(table.name, searchTerm)}
                        </div>
                        
                        <div className="table-row-badges">
                          {table.rowCount !== undefined && (
                            <span className="pill-badge row-badge" title={`${table.rowCount.toLocaleString()} rows`}>
                              {table.rowCount >= 1000 ? (table.rowCount / 1000).toFixed(1) + 'k' : table.rowCount}
                            </span>
                          )}
                          <span className="pill-badge col-badge" title={`${table.columns.length} columns`}>
                            {table.columns.length}c
                          </span>
                        </div>
                      </div>
                      
                      {table.matchedColumns && table.matchedColumns.length > 0 && searchTerm && (
                        <div className="matched-columns-list">
                          {table.matchedColumns.map(col => (
                            <div 
                              key={col.name} 
                              className={`matched-col-row ${selectedColumn === col.name ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectColumn(col.name);
                              }}
                              title={`Column: ${col.name} (${col.dataType})`}
                            >
                              <LayoutList size={11} className="col-icon" />
                              {renderHighlighted(col.name, searchTerm)}
                              <span className="col-type-tag">{col.dataType}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {activeTab === 'sps' && Object.entries(groupedSps).map(([schema, sps]) => (
          <div key={schema} className="schema-tree-group">
            <div 
              className="schema-group-header" 
              onClick={() => toggleSchema(`sp_${schema}`)}
            >
              <div className="schema-header-left">
                {collapsedSchemas[`sp_${schema}`] ? <ChevronRight size={13} className="chevron" /> : <ChevronDown size={13} className="chevron" />}
                <Layers size={13} className="schema-icon" />
                <span className="schema-name">{schema}</span>
              </div>
              <span className="schema-item-count">{sps.length}</span>
            </div>
            
            {!collapsedSchemas[`sp_${schema}`] && (
              <div className="schema-table-list">
                {sps.map(sp => {
                  const isActive = selectedSp && selectedSp.schema_name === sp.schema_name && selectedSp.sp_name === sp.sp_name;
                  
                  return (
                    <div 
                      key={`${sp.schema_name}.${sp.sp_name}`}
                      className={`table-list-row ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSp(sp)}
                      title={`${sp.schema_name}.${sp.sp_name}${sp.create_date ? `\nCreated: ${new Date(sp.create_date).toLocaleString()}` : ''}${sp.modify_date ? `\nUpdated: ${new Date(sp.modify_date).toLocaleString()}` : ''}`}
                    >
                      <div className="table-row-left">
                        <Code size={13} className="table-icon sp-icon" />
                        {renderHighlighted(sp.sp_name, searchTerm)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        
        {activeTab === 'tables' && Object.keys(groupedTables).length === 0 && (
          <EmptyState icon={FileQuestion} message="No tables found" subtext="Try adjusting your search filter" />
        )}

        {activeTab === 'sps' && Object.keys(groupedSps).length === 0 && (
          <EmptyState icon={FileQuestion} message="No stored procedures found" subtext="Try adjusting your search filter" />
        )}
      </div>
    </aside>
  );
}
