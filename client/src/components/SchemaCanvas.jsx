import React, { useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background,
  useNodesState,
  useEdgesState,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import TableNode from './TableNode';
import { Key, X, Compass, Eye, EyeOff, Layers, ArrowRight } from 'lucide-react';

const nodeTypes = {
  tableNode: TableNode
};

export default function SchemaCanvas({ 
  nodes: initialNodes, 
  edges: initialEdges,
  selectedTable,
  onSelectTable,
  selectedColumn,
  onSelectColumn,
  focusHops = 0,
  onSetFocusHops,
  pathResult,
  onClearPath
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Compute highlights (Table Neighbors, Orange Keys, Focus Hops, and Path Finder)
  const { 
    highlightedNodes, 
    orangeNodes, 
    pathNodes,
    focusNodes,
    highlightedEdges, 
    orangeEdges, 
    pathEdges,
    focusEdges,
    matchingCount 
  } = useMemo(() => {
    const hlNodes = new Set();
    const orNodes = new Set();
    const pNodes = new Set();
    const fNodes = new Set();

    const hlEdges = new Set();
    const orEdges = new Set();
    const pEdges = new Set();
    const fEdges = new Set();

    // 1. Path Finder Highlight
    if (pathResult && pathResult.found && pathResult.path.length > 0) {
      pathResult.path.forEach(id => pNodes.add(id));
      (pathResult.edgeIds || []).forEach(id => pEdges.add(id));
    }

    // 2. Focus Mode (BFS N-Hops from selectedTable)
    if (selectedTable && focusHops > 0) {
      fNodes.add(selectedTable);
      let currentLevel = new Set([selectedTable]);
      
      for (let hop = 0; hop < focusHops; hop++) {
        const nextLevel = new Set();
        edges.forEach(edge => {
          if (currentLevel.has(edge.source)) {
            fNodes.add(edge.target);
            fEdges.add(edge.id);
            nextLevel.add(edge.target);
          }
          if (currentLevel.has(edge.target)) {
            fNodes.add(edge.source);
            fEdges.add(edge.id);
            nextLevel.add(edge.source);
          }
        });
        currentLevel = nextLevel;
      }
    }

    // 3. Normal Table Selection (1-hop immediate neighbors)
    if (selectedTable && focusHops === 0) {
      hlNodes.add(selectedTable);
      edges.forEach(edge => {
        if (edge.source === selectedTable || edge.target === selectedTable) {
          hlEdges.add(edge.id);
          hlNodes.add(edge.source);
          hlNodes.add(edge.target);
        }
      });
    }

    // 4. Orange Key Match Highlighting
    if (selectedColumn) {
      const targetCol = selectedColumn.toLowerCase();
      nodes.forEach(node => {
        if (node.data.columns && node.data.columns.some(col => col.name.toLowerCase() === targetCol)) {
          orNodes.add(node.id);
          hlNodes.add(node.id);
        }
      });

      edges.forEach(edge => {
        const sourceMatch = edge.sourceHandle && edge.sourceHandle.toLowerCase() === targetCol;
        const targetMatch = edge.targetHandle && edge.targetHandle.toLowerCase() === targetCol;
        if (sourceMatch || targetMatch) {
          orEdges.add(edge.id);
          hlEdges.add(edge.id);
          orNodes.add(edge.source);
          orNodes.add(edge.target);
          hlNodes.add(edge.source);
          hlNodes.add(edge.target);
        }
      });
    }

    return { 
      highlightedNodes: hlNodes, 
      orangeNodes: orNodes, 
      pathNodes: pNodes,
      focusNodes: fNodes,
      highlightedEdges: hlEdges, 
      orangeEdges: orEdges,
      pathEdges: pEdges,
      focusEdges: fEdges,
      matchingCount: orNodes.size
    };
  }, [selectedTable, selectedColumn, focusHops, pathResult, edges, nodes]);

  const styledNodes = useMemo(() => {
    const isPathActive = pathNodes.size > 0;
    const isFocusActive = focusHops > 0 && selectedTable;

    return nodes.map(node => {
      const isOrange = orangeNodes.has(node.id);
      const isHl = highlightedNodes.has(node.id);
      const isPath = pathNodes.has(node.id);
      const isFocus = focusNodes.has(node.id);
      
      let className = '';

      if (isPathActive) {
        className = isPath ? 'highlight-path-node' : 'dimmed';
      } else if (isFocusActive) {
        className = isFocus ? (node.id === selectedTable ? 'focus-center-node' : 'focus-neighbor-node') : 'dimmed';
      } else if (selectedColumn) {
        className = isOrange ? 'highlight-orange-card' : 'dimmed';
      } else if (selectedTable) {
        className = isHl ? '' : 'dimmed';
      }

      return {
        ...node,
        data: {
          ...node.data,
          selectedColumn,
          onSelectColumn
        },
        className,
        selected: node.id === selectedTable
      };
    });
  }, [nodes, selectedTable, selectedColumn, focusHops, orangeNodes, highlightedNodes, pathNodes, focusNodes, onSelectColumn]);

  const styledEdges = useMemo(() => {
    const isPathActive = pathEdges.size > 0;
    const isFocusActive = focusHops > 0 && selectedTable;

    return edges.map(edge => {
      const isOrange = orangeEdges.has(edge.id);
      const isHl = highlightedEdges.has(edge.id);
      const isPath = pathEdges.has(edge.id);
      const isFocus = focusEdges.has(edge.id);

      if (isPathActive) {
        return {
          ...edge,
          className: isPath ? 'highlighted-path' : '',
          animated: isPath,
          style: isPath 
            ? { stroke: '#8b5cf6', strokeWidth: 3.5, zIndex: 25 }
            : { stroke: 'var(--border)', opacity: 0.1 }
        };
      }

      if (isFocusActive) {
        return {
          ...edge,
          className: isFocus ? 'highlighted' : '',
          animated: isFocus,
          style: isFocus 
            ? { stroke: 'var(--accent)', strokeWidth: 2.5, zIndex: 15 }
            : { stroke: 'var(--border)', opacity: 0.1 }
        };
      }

      if (selectedColumn) {
        return {
          ...edge,
          className: isOrange ? 'highlighted-orange' : '',
          animated: isOrange,
          style: isOrange 
            ? { stroke: '#f97316', strokeWidth: 3.5, zIndex: 20 }
            : { stroke: 'var(--border)', opacity: 0.15 }
        };
      }

      return {
        ...edge,
        className: isHl ? 'highlighted' : '',
        animated: isHl,
        style: isHl 
          ? { stroke: 'var(--accent)', strokeWidth: 2.5 } 
          : { stroke: 'var(--border)', opacity: selectedTable ? 0.2 : 0.6 }
      };
    });
  }, [edges, selectedTable, selectedColumn, focusHops, orangeEdges, highlightedEdges, pathEdges, focusEdges]);

  const onNodeClick = useCallback((_, node) => {
    onSelectTable(node.id);
  }, [onSelectTable]);

  const onPaneClick = useCallback(() => {
    if (pathResult) {
      onClearPath?.();
    } else if (selectedColumn) {
      onSelectColumn(null);
    } else {
      onSelectTable(null);
      if (focusHops > 0) onSetFocusHops?.(0);
    }
  }, [onSelectTable, onSelectColumn, selectedColumn, pathResult, onClearPath, focusHops, onSetFocusHops]);

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={20} size={1} />
        <MiniMap 
          nodeColor={(node) => {
            if (pathNodes.has(node.id)) return '#8b5cf6';
            if (orangeNodes.has(node.id)) return '#f97316';
            return node.data?.color || 'var(--bg-tertiary)';
          }}
          maskColor="var(--bg-secondary)"
        />
        <Controls className="react-flow__controls" position="bottom-left" />

        {/* Floating Focus Mode Control Pill (Appears when table is selected) */}
        {selectedTable && !pathResult && (
          <Panel position="top-right" className="canvas-focus-control-panel">
            <div className="focus-pill-container">
              <span className="focus-pill-label">
                <Eye size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Focus:
              </span>
              <button 
                className={`btn-focus-pill ${focusHops === 0 ? 'active' : ''}`}
                onClick={() => onSetFocusHops?.(0)}
                title="Show full schema"
              >
                All
              </button>
              <button 
                className={`btn-focus-pill ${focusHops === 1 ? 'active' : ''}`}
                onClick={() => onSetFocusHops?.(1)}
                title="Focus 1 hop (Direct neighbors only)"
              >
                1-Hop
              </button>
              <button 
                className={`btn-focus-pill ${focusHops === 2 ? 'active' : ''}`}
                onClick={() => onSetFocusHops?.(2)}
                title="Focus 2 hops (Extended neighborhood)"
              >
                2-Hops
              </button>
              <button 
                className={`btn-focus-pill ${focusHops === 3 ? 'active' : ''}`}
                onClick={() => onSetFocusHops?.(3)}
                title="Focus 3 hops (Deep subsystem)"
              >
                3-Hops
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Path Finder Active Banner */}
        {pathResult && pathResult.found && (
          <Panel position="top-center" className="path-highlight-banner">
            <div className="path-highlight-content">
              <Compass size={15} className="text-accent" />
              <span>
                Active Route: <strong>{pathResult.path[0]}</strong> <ArrowRight size={12} style={{ display: 'inline', margin: '0 4px' }} /> <strong>{pathResult.path[pathResult.path.length - 1]}</strong> ({pathResult.path.length} tables, {pathResult.steps.length} hops)
              </span>
              <button 
                className="key-highlight-clear" 
                onClick={onClearPath}
                title="Clear Path Highlight"
              >
                <X size={14} />
              </button>
            </div>
          </Panel>
        )}

        {/* Floating Key Match Notification Banner */}
        {selectedColumn && !pathResult && (
          <Panel position="top-center" className="key-highlight-banner">
            <div className="key-highlight-content">
              <Key size={14} className="key-highlight-icon" />
              <span>
                Highlighting tables with key <strong>"{selectedColumn}"</strong> ({matchingCount} {matchingCount === 1 ? 'table' : 'tables'} found)
              </span>
              <button 
                className="key-highlight-clear" 
                onClick={() => onSelectColumn(null)}
                title="Clear key highlight"
              >
                <X size={14} />
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
