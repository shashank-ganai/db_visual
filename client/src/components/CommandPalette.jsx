import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Table2, Key, Code, ArrowRight, LayoutTemplate, 
  Sun, Moon, RefreshCw, Bot, ArrowRightLeft, Image as ImageIcon,
  Compass, Zap, X
} from 'lucide-react';

export default function CommandPalette({
  isOpen,
  onClose,
  schemaData,
  spsData,
  onSelectTable,
  onSelectColumn,
  onSelectSp,
  onToggleTheme,
  theme,
  onRefresh,
  onToggleAiChat,
  onToggleCompare,
  onTogglePathFinder,
  onSetFocusMode
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input on open & reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Aggregate searchable items
  const results = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();

    const items = [];

    // 1. Actions
    const actions = [
      {
        id: 'action-pathfinder',
        category: 'Actions',
        title: 'Open Path Finder & JOIN Generator',
        subtitle: 'Find the shortest relationship path between two tables and generate SQL',
        icon: Compass,
        action: () => { onTogglePathFinder?.(); onClose(); }
      },
      {
        id: 'action-ai',
        category: 'Actions',
        title: 'Ask AI Assistant',
        subtitle: 'Chat with AI to generate read-only SQL queries and explain schema',
        icon: Bot,
        action: () => { onToggleAiChat?.(); onClose(); }
      },
      {
        id: 'action-compare',
        category: 'Actions',
        title: 'Compare Databases',
        subtitle: 'Diff tables, columns, and stored procedures across databases',
        icon: ArrowRightLeft,
        action: () => { onToggleCompare?.(); onClose(); }
      },
      {
        id: 'action-refresh',
        category: 'Actions',
        title: 'Refresh Schema & Metadata',
        subtitle: 'Reload tables, columns, and foreign keys from SQL Server',
        icon: RefreshCw,
        action: () => { onRefresh?.(); onClose(); }
      },
      {
        id: 'action-theme',
        category: 'Actions',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle user interface appearance',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => { onToggleTheme?.(); onClose(); }
      }
    ];

    actions.forEach(act => {
      if (!q || act.title.toLowerCase().includes(q) || act.subtitle.toLowerCase().includes(q)) {
        items.push(act);
      }
    });

    // 2. Tables
    if (schemaData?.tables) {
      schemaData.tables.forEach(table => {
        const fullId = `${table.schema}.${table.name}`;
        if (!q || table.name.toLowerCase().includes(q) || table.schema.toLowerCase().includes(q)) {
          items.push({
            id: `table-${fullId}`,
            category: 'Tables',
            title: table.name,
            subtitle: `${table.schema} • ${table.columns.length} cols • ${(table.rowCount || 0).toLocaleString()} rows`,
            icon: Table2,
            action: () => { onSelectTable?.(fullId); onClose(); }
          });
        }
      });
    }

    // 3. Stored Procedures
    if (spsData) {
      spsData.forEach(sp => {
        const fullId = `${sp.schema_name}.${sp.sp_name}`;
        if (!q || sp.sp_name.toLowerCase().includes(q) || sp.schema_name.toLowerCase().includes(q)) {
          items.push({
            id: `sp-${fullId}`,
            category: 'Stored Procedures',
            title: sp.sp_name,
            subtitle: `${sp.schema_name} • Procedure`,
            icon: Code,
            action: () => { onSelectSp?.(sp); onClose(); }
          });
        }
      });
    }

    // 4. Columns (Matching query)
    if (q && schemaData?.tables) {
      const seenColNames = new Set();
      schemaData.tables.forEach(table => {
        table.columns.forEach(col => {
          if (col.name.toLowerCase().includes(q) && !seenColNames.has(col.name.toLowerCase())) {
            seenColNames.add(col.name.toLowerCase());
            items.push({
              id: `col-${col.name}`,
              category: 'Columns & Keys',
              title: col.name,
              subtitle: `Highlight all tables containing key "${col.name}" across schema in orange`,
              icon: Key,
              action: () => { onSelectColumn?.(col.name); onClose(); }
            });
          }
        });
      });
    }

    return items.slice(0, 50); // Cap at 50 results for speed
  }, [isOpen, query, schemaData, spsData, theme, onTogglePathFinder, onToggleAiChat, onToggleCompare, onRefresh, onToggleTheme, onSelectTable, onSelectSp, onSelectColumn, onClose]);

  // Adjust selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.command-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div 
        className="command-palette-container" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="command-palette-header">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search tables, columns, procedures, or actions... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="command-clear-btn" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
          <span className="command-esc-badge">ESC</span>
        </div>

        {/* Results List */}
        <div className="command-palette-results" ref={listRef}>
          {results.length === 0 ? (
            <div className="command-palette-empty">
              <p>No results found for "<strong>{query}</strong>"</p>
              <span>Try searching for a table name, column, stored procedure, or action.</span>
            </div>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              
              // Group header when category changes
              const isFirstOfCategory = index === 0 || results[index - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {isFirstOfCategory && (
                    <div className="command-category-header">
                      {item.category}
                    </div>
                  )}
                  <div
                    className={`command-item ${isSelected ? 'active' : ''}`}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={`command-item-icon-wrapper ${item.category.toLowerCase().replace(/[^a-z]/g, '')}`}>
                      <Icon size={16} />
                    </div>
                    <div className="command-item-details">
                      <div className="command-item-title">{item.title}</div>
                      <div className="command-item-subtitle">{item.subtitle}</div>
                    </div>
                    {isSelected && (
                      <div className="command-item-enter">
                        <span>Select</span>
                        <ArrowRight size={12} />
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
