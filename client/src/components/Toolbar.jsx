import React from 'react';
import { 
  Database, Server, RefreshCw, LogOut, Sun, Moon, Maximize, 
  LayoutTemplate, Image as ImageIcon, Bot, ArrowRightLeft, Unplug,
  Compass, Search, ChevronDown, CheckCircle2, User, Shield
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
  layoutDirection,
  onToggleLayout,
  onToggleAiChat,
  onToggleCompare,
  onTogglePathFinder,
  onOpenCommandPalette
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
      {/* Left Section: Branding & Search */}
      <div className="toolbar-left">
        <div className="app-title">
          <div className="app-logo-icon">
            <Database size={18} />
          </div>
          <span className="app-title-text">DB Visualizer</span>
          <span className="app-badge">MSSQL</span>
        </div>
        
        <div className="toolbar-divider" />
        
        <div className="connection-pill" title="Connected to SQL Server instance">
          <span className="status-dot active"></span>
          <span className="connection-status-text">Connected</span>
        </div>

        <div className="toolbar-divider" />
        
        {/* Quick Search / Command Palette Launcher */}
        <button 
          className="toolbar-search-trigger" 
          onClick={onOpenCommandPalette}
          title="Search tables, procedures, keys (Ctrl+K / Cmd+K)"
        >
          <Search size={14} className="search-icon" />
          <span>Quick search...</span>
          <kbd>Ctrl+K</kbd>
        </button>
      </div>
      
      {/* Center Section: Database Switcher & Canvas Controls */}
      <div className="toolbar-center">
        <div className="db-selector-capsule">
          <Server size={14} className="capsule-icon" />
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
          <ChevronDown size={12} className="select-chevron" />
        </div>
        
        <button 
          className="btn-icon-subtle" 
          onClick={async () => { const success = await onRefresh(); if(success) showToast('Schema metadata refreshed'); }} 
          title="Refresh Schema Metadata"
        >
          <RefreshCw size={15} />
        </button>
        
        <div className="toolbar-divider" />
        
        <button 
          className="btn-icon-subtle" 
          onClick={onToggleLayout} 
          title={`Switch layout direction to ${layoutDirection === 'RIGHT' ? 'Vertical (Top to Bottom)' : 'Horizontal (Left to Right)'}`}
        >
          <LayoutTemplate size={15} style={{ transform: layoutDirection === 'DOWN' ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease' }} />
        </button>
        
        <button 
          className="btn-icon-subtle" 
          onClick={() => fitView({ padding: 0.2, duration: 600 })} 
          title="Fit diagram to screen"
        >
          <Maximize size={15} />
        </button>
      </div>

      {/* Right Section: Tool Actions */}
      <div className="toolbar-right">
        <button 
          className="btn-tool" 
          onClick={onTogglePathFinder} 
          title="Trace foreign key relationship paths between tables"
        >
          <Compass size={15} className="tool-icon-violet" /> 
          <span>Path Finder</span>
        </button>

        <button 
          className="btn-tool" 
          onClick={onToggleAiChat} 
          title="Query schema with AI assistant"
        >
          <Bot size={15} className="tool-icon-cyan" /> 
          <span>Ask AI</span>
        </button>

        <button 
          className="btn-tool" 
          onClick={onToggleCompare} 
          title="Compare schemas & stored procedures across databases or servers"
        >
          <ArrowRightLeft size={15} className="tool-icon-amber" /> 
          <span>Compare DBs</span>
        </button>

        <button 
          className="btn btn-primary btn-sm" 
          onClick={handleExport}
          title="Export current schema diagram as high-res PNG image"
        >
          <ImageIcon size={14} /> 
          <span>Export PNG</span>
        </button>

        <div className="toolbar-divider" />

        <button 
          className="btn-icon-subtle" 
          onClick={onToggleTheme} 
          title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button 
          className="btn-icon-subtle" 
          onClick={onDisconnect} 
          title="Disconnect from database" 
          style={{ color: 'var(--warning)' }}
        >
          <Unplug size={15} />
        </button>

        {currentUser && (
          <div 
            className="toolbar-user-pill" 
            title={`Signed in as ${currentUser.name || currentUser.username} (${currentUser.role || 'User'})`}
          >
            <div className="user-avatar-tiny">
              <User size={12} />
            </div>
            <span className="user-pill-name">{currentUser.name || currentUser.username}</span>
            <span className="user-pill-badge">{currentUser.role?.split(' ')[0] || 'User'}</span>
          </div>
        )}

        <button 
          className="btn-icon-subtle" 
          onClick={onLogout} 
          title="Sign out of DB Visualizer" 
          style={{ color: 'var(--danger)' }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
