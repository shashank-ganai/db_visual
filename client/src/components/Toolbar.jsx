import React from 'react';
import { 
  Database, Server, RefreshCw, LogOut, Sun, Moon, 
  Image as ImageIcon, Bot, ArrowRightLeft, Unplug,
  Compass, Search, ChevronDown, User, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useToast } from './ToastProvider';

export default function Toolbar({ 
  currentDatabase, 
  databases, 
  currentUser,
  onSwitchDatabase, 
  onRefresh, 
  onDisconnect,
  onLogout,
  theme,
  onToggleTheme,
  onToggleAiChat,
  onToggleCompare,
  onTogglePathFinder,
  onOpenCommandPalette,
  sidebarCollapsed,
  onToggleSidebar
}) {
  const { getNodes, fitView } = useReactFlow();
  const showToast = useToast();

  const handleExport = () => {
    const nodesBounds = getNodesBounds(getNodes());
    const viewport = getViewportForBounds(
      nodesBounds,
      1920,
      1080,
      0.5,
      2,
      1
    );

    const viewportNode = document.querySelector('.react-flow__viewport');
    
    toPng(viewportNode, {
      backgroundColor: theme === 'dark' ? '#0a0d14' : '#f8fafc',
      width: 1920,
      height: 1080,
      style: {
        width: '1920px',
        height: '1080px',
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
      }
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.setAttribute('download', `${currentDatabase || 'database'}-schema.png`);
      a.setAttribute('href', dataUrl);
      a.click();
      showToast('Schema diagram exported as PNG');
    }).catch(err => {
      console.error('Export failed:', err);
    });
  };

  return (
    <header className="toolbar glass">
      {/* Left Section: Branding + Sidebar Toggle + DB Selector */}
      <div className="toolbar-left">
        <button 
          className="btn-icon-subtle sidebar-toggle-btn" 
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>

        <div className="app-title">
          <div className="app-logo-icon">
            <Database size={16} />
          </div>
          <span className="app-title-text">DB Visualizer</span>
          <span className="app-badge">MSSQL</span>
        </div>
        
        <div className="toolbar-divider" />

        <div className="db-selector-capsule">
          <Server size={13} className="capsule-icon" />
          <select 
            value={currentDatabase} 
            onChange={(e) => onSwitchDatabase(e.target.value)}
            title="Active Database"
            className="db-select-input"
          >
            {databases.map(db => (
              <option key={db} value={db}>{db}</option>
            ))}
            {currentDatabase && !databases.includes(currentDatabase) && (
              <option value={currentDatabase}>{currentDatabase}</option>
            )}
          </select>
          <ChevronDown size={11} className="select-chevron" />
        </div>

        <button 
          className="btn-icon-subtle" 
          onClick={async () => { const success = await onRefresh(); if(success) showToast('Schema metadata refreshed'); }} 
          title="Refresh Schema Metadata"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      
      {/* Center: Compact Search Trigger */}
      <div className="toolbar-center">
        <button 
          className="toolbar-search-trigger" 
          onClick={onOpenCommandPalette}
          title="Search tables, procedures, keys (Ctrl+K / Cmd+K)"
        >
          <Search size={13} className="search-icon" />
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      {/* Right Section: Tool Actions */}
      <div className="toolbar-right">
        <button 
          className="btn-tool" 
          onClick={onTogglePathFinder} 
          title="Trace foreign key relationship paths between tables"
        >
          <Compass size={14} className="tool-icon-violet" /> 
          <span>Path Finder</span>
        </button>

        <button 
          className="btn-tool" 
          onClick={onToggleAiChat} 
          title="Query schema with AI assistant"
        >
          <Bot size={14} className="tool-icon-cyan" /> 
          <span>Ask AI</span>
        </button>

        <button 
          className="btn-tool" 
          onClick={onToggleCompare} 
          title="Compare schemas & stored procedures across databases or servers"
        >
          <ArrowRightLeft size={14} className="tool-icon-amber" /> 
          <span>Compare</span>
        </button>

        <button 
          className="btn-icon-subtle" 
          onClick={handleExport}
          title="Export current schema diagram as high-res PNG image"
        >
          <ImageIcon size={14} />
        </button>

        <div className="toolbar-divider" />

        <button 
          className="btn-icon-subtle" 
          onClick={onToggleTheme} 
          title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button 
          className="btn-icon-subtle" 
          onClick={onDisconnect} 
          title="Disconnect from database" 
          style={{ color: 'var(--warning)' }}
        >
          <Unplug size={14} />
        </button>

        {currentUser && (
          <div 
            className="toolbar-user-pill" 
            title={`Signed in as ${currentUser.name || currentUser.username} (${currentUser.role || 'User'})`}
          >
            <div className="user-avatar-tiny">
              <User size={11} />
            </div>
            <span className="user-pill-name">{currentUser.name || currentUser.username}</span>
          </div>
        )}

        <button 
          className="btn-icon-subtle" 
          onClick={onLogout} 
          title="Sign out of DB Visualizer" 
          style={{ color: 'var(--danger)' }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}
