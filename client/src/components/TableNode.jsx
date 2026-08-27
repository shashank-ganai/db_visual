import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Key, Link, ChevronDown, ChevronUp, Table2 } from 'lucide-react';

const MAX_VISIBLE_COLS = 8;

function TableNode({ data, selected }) {
  const { schema, name, columns, color, rowCount } = data;
  const [expanded, setExpanded] = useState(false);
  
  const isSelected = selected;

  // Check if this table has a column matching the currently selected column/key
  const hasMatchingKey = Boolean(
    data.selectedColumn && 
    columns.some(col => col.name.toLowerCase() === data.selectedColumn.toLowerCase())
  );

  // Auto-expand if the matching column is hidden beyond MAX_VISIBLE_COLS
  useEffect(() => {
    if (hasMatchingKey && data.selectedColumn) {
      const matchIndex = columns.findIndex(
        col => col.name.toLowerCase() === data.selectedColumn.toLowerCase()
      );
      if (matchIndex >= MAX_VISIBLE_COLS) {
        setExpanded(true);
      }
    }
  }, [hasMatchingKey, data.selectedColumn, columns]);

  const visibleColumns = expanded ? columns : columns.slice(0, MAX_VISIBLE_COLS);
  const hiddenCount = columns.length - MAX_VISIBLE_COLS;

  // Format row count
  const formattedCount = rowCount >= 1000 
    ? (rowCount / 1000).toFixed(1) + 'k' 
    : (rowCount !== undefined ? rowCount : 0);

  return (
    <div className={`table-node ${isSelected ? 'selected' : ''} ${hasMatchingKey ? 'highlight-orange-card' : ''}`}>
      {/* Schema Color Accent Bar */}
      <div 
        className="table-node-schema-bar" 
        style={{ backgroundColor: hasMatchingKey ? '#f97316' : (color || 'var(--accent)') }}
      />
      
      {/* Table Card Header */}
      <div className="table-node-header">
        <div className="table-node-title">
          <span className="table-name-text" title={`${schema}.${name}`}>
            {name}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {hasMatchingKey && (
              <span className="key-match-badge" title={`Contains matching key: ${data.selectedColumn}`}>
                <Key size={9} />
                Match
              </span>
            )}
            <span className="table-node-row-badge" title={`${(rowCount || 0).toLocaleString()} rows`}>
              {formattedCount}
            </span>
          </div>
        </div>

        <div className="table-node-schema-tag" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{schema}</span>
          {data.modifyDate && (
            <span 
              className="table-node-date-tag" 
              title={`Created: ${data.createDate ? new Date(data.createDate).toLocaleString() : 'N/A'}\nUpdated: ${new Date(data.modifyDate).toLocaleString()}`}
            >
              {new Date(data.modifyDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Columns List */}
      <div className="table-node-columns">
        {visibleColumns.map(col => {
          const isColMatch = Boolean(
            data.selectedColumn && 
            col.name.toLowerCase() === data.selectedColumn.toLowerCase()
          );
          
          return (
            <div 
              key={col.name} 
              className={`table-node-column ${isColMatch ? 'orange-match' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (data.onSelectColumn) {
                  const isCurrent = data.selectedColumn && data.selectedColumn.toLowerCase() === col.name.toLowerCase();
                  data.onSelectColumn(isCurrent ? null : col.name);
                }
              }}
              style={{ cursor: data.onSelectColumn ? 'pointer' : 'default' }}
              title={isColMatch ? `Key Match: "${col.name}"` : `Highlight "${col.name}" across all tables`}
            >
              
              {/* Left Handle (Target for Incoming FKs) */}
              <Handle 
                type="target" 
                position={Position.Left} 
                id={col.name}
                style={{ 
                  left: -5, 
                  background: isColMatch ? '#f97316' : 'var(--border-hover)', 
                  width: isColMatch ? 9 : 7, 
                  height: isColMatch ? 9 : 7, 
                  border: isColMatch ? '2px solid #fff' : 'none',
                  zIndex: isColMatch ? 10 : 1
                }}
                isConnectable={false}
              />
              
              <div className="column-icon-box">
                {col.isPrimaryKey && <Key className={`pk-icon ${isColMatch ? 'text-orange' : ''}`} size={12} />}
                {col.isForeignKey && !col.isPrimaryKey && <Link className={`fk-icon ${isColMatch ? 'text-orange' : ''}`} size={12} />}
              </div>
              
              <div className="column-name-label" title={col.name}>{col.name}</div>
              
              <div className="column-type-label">
                {col.dataType.replace('character varying', 'varchar')}
                {col.isNullable && <span className="null-indicator" title="Nullable">?</span>}
              </div>

              {/* Right Handle (Source for Outgoing FKs) */}
              <Handle 
                type="source" 
                position={Position.Right} 
                id={col.name}
                style={{ 
                  right: -5, 
                  background: isColMatch ? '#f97316' : 'var(--border-hover)', 
                  width: isColMatch ? 9 : 7, 
                  height: isColMatch ? 9 : 7, 
                  border: isColMatch ? '2px solid #fff' : 'none',
                  zIndex: isColMatch ? 10 : 1
                }}
                isConnectable={false}
              />
            </div>
          );
        })}
      </div>
      
      {/* Show More / Less Expander */}
      {hiddenCount > 0 && (
        <button 
          className="table-node-expand-btn" 
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <ChevronUp size={13}/> Collapse
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <ChevronDown size={13}/> +{hiddenCount} more
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default React.memo(TableNode);
