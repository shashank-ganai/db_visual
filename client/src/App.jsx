import React, { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useConnection } from './hooks/useConnection';
import { useSchema } from './hooks/useSchema';
import { useSps } from './hooks/useSps';
import { useLayout } from './hooks/useLayout';
import { schemaToFlow } from './utils/schemaToFlow';

import ConnectionForm from './components/ConnectionForm';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import SchemaCanvas from './components/SchemaCanvas';
import DetailPanel from './components/DetailPanel';
import SpDetailPanel from './components/SpDetailPanel';
import AiChat from './components/AiChat';
import CompareModal from './components/CompareModal';
import LoginForm from './components/LoginForm';
import CommandPalette from './components/CommandPalette';
import PathFinderModal from './components/PathFinderModal';
import { ToastProvider } from './components/ToastProvider';
import { FullScreenLoader, FullScreenError } from './components/LoadingStates';
import StatsBar from './components/StatsBar';
import SchemaLegend from './components/SchemaLegend';

function App() {
  const { 
    isConnected, 
    loading: connLoading, 
    error: connError, 
    connect, 
    disconnect,
    databases,
    currentDatabase,
    switchDatabase,
    forgetConnection,
    hasSavedConnection
  } = useConnection();
  
  const { 
    schema, 
    loading: schemaLoading, 
    error: schemaError, 
    fetchSchema,
    updateSchema
  } = useSchema();

  const { sps, fetchSps } = useSps();

  const { getLayout, loadingLayout } = useLayout();
  
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [selectedSp, setSelectedSp] = useState(null);
  
  // Phase 2: Focus Mode & Path Finder & Command Palette State
  const [focusHops, setFocusHops] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isPathFinderOpen, setIsPathFinderOpen] = useState(false);
  const [activePathResult, setActivePathResult] = useState(null);

  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [aiChatInitialMessage, setAiChatInitialMessage] = useState('');
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const layoutDirection = 'RIGHT';
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // VS Code Webview Integration
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'vscode-theme-vars') {
        const { isDark, themeVars } = event.data;
        setTheme(isDark ? 'dark' : 'light');
        
        const root = document.documentElement;
        if (themeVars['--vscode-editor-background']) {
          root.style.setProperty('--bg-primary', themeVars['--vscode-editor-background']);
          root.style.setProperty('--bg-secondary', themeVars['--vscode-editorWidget-background']);
          root.style.setProperty('--bg-tertiary', themeVars['--vscode-editor-background']);
          root.style.setProperty('--text-primary', themeVars['--vscode-editor-foreground']);
          root.style.setProperty('--accent', themeVars['--vscode-button-background']);
          root.style.setProperty('--accent-hover', themeVars['--vscode-button-hoverBackground']);
          if (themeVars['--vscode-panel-border']) {
            root.style.setProperty('--border', themeVars['--vscode-panel-border']);
            root.style.setProperty('--border-light', themeVars['--vscode-panel-border']);
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Notify VS Code that the React app is ready to receive messages
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'ready' }, '*');
    }
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetch('/api/auth-status')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.authenticated);
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated && isConnected && !schema) {
      fetchSchema();
      fetchSps();
    }
  }, [isAuthenticated, isConnected, schema, fetchSchema, fetchSps]);

  useEffect(() => {
    if (isAuthenticated && schema) {
      const { nodes: rawNodes, edges: rawEdges } = schemaToFlow(schema);
      getLayout(rawNodes, rawEdges, layoutDirection).then(({ layoutedNodes, layoutedEdges }) => {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      });
    }
  }, [isAuthenticated, schema, layoutDirection, getLayout]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setCurrentUser(null);
      disconnect();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (isAuthenticated === null) {
    return <FullScreenLoader message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <LoginForm 
          onLoginSuccess={(user) => {
            setIsAuthenticated(true);
            setCurrentUser(user);
          }} 
        />
      </ToastProvider>
    );
  }

  const handleRefresh = async () => {
    const newSchema = await fetchSchema();
    await fetchSps();
    if (newSchema) {
      setSelectedTable(null);
      setSelectedColumn(null);
      setSelectedSp(null);
      setActivePathResult(null);
      setFocusHops(0);
      return true;
    }
    return false;
  };

  const handleSwitchDatabase = async (dbName) => {
    if (dbName === currentDatabase) return;
    try {
      const newSchema = await switchDatabase(dbName);
      updateSchema(newSchema);
      fetchSps();
      setSelectedTable(null);
      setSelectedColumn(null);
      setSelectedSp(null);
      setActivePathResult(null);
      setFocusHops(0);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isConnected) {
    return <ConnectionForm onConnect={connect} loading={connLoading} error={connError} onLogout={handleLogout} savedConnection={hasSavedConnection()} onForgetConnection={forgetConnection} />;
  }

  const isLoading = schemaLoading || loadingLayout;

  return (
    <ToastProvider>
      <div className="app-container">
        <ReactFlowProvider>
          <Toolbar 
            currentDatabase={currentDatabase}
            databases={databases}
            currentUser={currentUser}
            onSwitchDatabase={handleSwitchDatabase}
            onRefresh={handleRefresh}
            onDisconnect={disconnect}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            onToggleAiChat={() => setIsAiChatOpen(!isAiChatOpen)}
            onToggleCompare={() => setIsCompareOpen(!isCompareOpen)}
            onTogglePathFinder={() => setIsPathFinderOpen(!isPathFinderOpen)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          />
          
          <div className="main-content">
            <Sidebar 
              schemaData={schema} 
              spsData={sps}
              currentUser={currentUser}
              selectedTable={selectedTable}
              onSelectTable={(id) => { setSelectedTable(id); setSelectedSp(null); }}
              selectedColumn={selectedColumn}
              onSelectColumn={setSelectedColumn}
              selectedSp={selectedSp}
              onSelectSp={(sp) => { setSelectedSp(sp); setSelectedTable(null); }}
              onLogout={handleLogout}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(c => !c)}
            />
            
            {isLoading ? (
              <FullScreenLoader message={schemaLoading ? 'Fetching Schema...' : 'Calculating Layout in Worker...'} />
            ) : (schemaError && !schema) ? (
              <FullScreenError message={`Error loading schema: ${schemaError}`} onReconnect={handleLogout} />
            ) : (
              <>
              <SchemaCanvas 
                nodes={nodes}
                edges={edges}
                selectedTable={selectedTable}
                onSelectTable={(id) => { 
                  setSelectedTable(id); 
                  setSelectedColumn(null); 
                  setSelectedSp(null); 
                }}
                selectedColumn={selectedColumn}
                onSelectColumn={setSelectedColumn}
                focusHops={focusHops}
                onSetFocusHops={setFocusHops}
                pathResult={activePathResult}
                onClearPath={() => setActivePathResult(null)}
              />
              <DetailPanel 
                schemaData={schema}
                selectedTableId={selectedTable}
                onClose={() => {
                  setSelectedTable(null);
                  if (focusHops > 0) setFocusHops(0);
                }}
                onSelectTable={(id) => { setSelectedTable(id); setSelectedSp(null); }}
                selectedColumn={selectedColumn}
                onSelectColumn={setSelectedColumn}
                theme={theme}
              />
              <SpDetailPanel 
                selectedSp={selectedSp}
                onClose={() => setSelectedSp(null)}
                theme={theme}
                onOpenAiChat={(msg) => {
                  setAiChatInitialMessage(msg);
                  setIsAiChatOpen(true);
                }}
              />
              <AiChat 
                isOpen={isAiChatOpen} 
                onClose={() => setIsAiChatOpen(false)} 
                currentDatabase={currentDatabase}
                schemaData={schema}
                spsData={sps}
                selectedSp={selectedSp}
                selectedTable={selectedTable}
                initialMessage={aiChatInitialMessage}
                onInitialMessageConsumed={() => setAiChatInitialMessage('')}
                isDetailOpen={!!selectedTable || !!selectedSp}
                detailWidth={selectedSp ? '550px' : '400px'}
              />
              <CompareModal
                isOpen={isCompareOpen}
                onClose={() => setIsCompareOpen(false)}
                currentDatabase={currentDatabase}
                databases={databases}
                currentSchema={schema}
                currentSps={sps}
              />
              <PathFinderModal
                isOpen={isPathFinderOpen}
                onClose={() => setIsPathFinderOpen(false)}
                schemaData={schema}
                onApplyPathToCanvas={setActivePathResult}
                onClearCanvasPath={() => setActivePathResult(null)}
                initialStartTable={selectedTable}
              />
              <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                schemaData={schema}
                spsData={sps}
                onSelectTable={(id) => {
                  setSelectedTable(id);
                  setSelectedSp(null);
                  setSelectedColumn(null);
                }}
                onSelectColumn={(colName) => {
                  setSelectedColumn(colName);
                  setSelectedTable(null);
                  setSelectedSp(null);
                }}
                onSelectSp={(sp) => {
                  setSelectedSp(sp);
                  setSelectedTable(null);
                  setSelectedColumn(null);
                }}
                onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                theme={theme}
                onRefresh={handleRefresh}
                onToggleAiChat={() => setIsAiChatOpen(true)}
                onToggleCompare={() => setIsCompareOpen(true)}
                onTogglePathFinder={() => setIsPathFinderOpen(true)}
              />
              <SchemaLegend schemaData={schema} />
              <StatsBar 
                schemaData={schema} 
                spsData={sps} 
                isDetailOpen={!!selectedTable || !!selectedSp}
                detailWidth={selectedSp ? '550px' : '400px'}
              />
            </>
          )}
        </div>
      </ReactFlowProvider>
    </div>
  </ToastProvider>
  );
}

export default App;
