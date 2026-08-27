import { useState, useCallback, useRef, useEffect } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';

const fallbackElk = new ELK();

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 28;
const MAX_ROWS = 8;
const SHOW_MORE_HEIGHT = 34;

function calculateNodeHeight(columnsLength) {
  const visibleRows = Math.min(columnsLength, MAX_ROWS);
  const showMore = columnsLength > MAX_ROWS ? SHOW_MORE_HEIGHT : 0;
  return HEADER_HEIGHT + (visibleRows * ROW_HEIGHT) + showMore;
}

export function useLayout() {
  const [loading, setLoading] = useState(false);
  const workerRef = useRef(null);
  const pendingRequests = useRef(new Map());
  const reqIdCounter = useRef(0);

  useEffect(() => {
    try {
      const worker = new Worker(new URL('../workers/elkWorker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const { id, type, layoutedGraph, message } = e.data;
        const pending = pendingRequests.current.get(id);
        if (pending) {
          pendingRequests.current.delete(id);
          if (type === 'SUCCESS') {
            pending.resolve(layoutedGraph);
          } else {
            pending.reject(new Error(message || 'Worker layout failed'));
          }
        }
      };
      worker.onerror = (err) => {
        console.warn('ELK Worker encountered an error, will use main-thread fallback:', err);
        pendingRequests.current.forEach(pending => {
           pending.reject(new Error('Worker crashed'));
        });
        pendingRequests.current.clear();
        workerRef.current = null;
      };
      workerRef.current = worker;
    } catch (e) {
      console.warn('Web Worker not supported or failed to initialize, using main thread for ELK:', e);
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const getLayout = useCallback(async (nodes, edges, direction = 'RIGHT') => {
    setLoading(true);
    try {
      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
          'elk.edgeRouting': 'ORTHOGONAL'
        },
        children: nodes.map(node => ({
          id: node.id,
          width: NODE_WIDTH,
          height: calculateNodeHeight(node.data.columns.length)
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target]
        }))
      };

      let layoutedGraph;
      if (workerRef.current) {
        const reqId = ++reqIdCounter.current;
        layoutedGraph = await new Promise((resolve, reject) => {
          pendingRequests.current.set(reqId, { resolve, reject });
          workerRef.current.postMessage({ id: reqId, graph });
          
          // Safety timeout: if worker hangs for >6 seconds, reject and fallback
          setTimeout(() => {
            if (pendingRequests.current.has(reqId)) {
              pendingRequests.current.delete(reqId);
              reject(new Error('Worker timeout exceeded (6s)'));
            }
          }, 6000);
        });
      } else {
        layoutedGraph = await fallbackElk.layout(graph);
      }

      // Map layout back to React Flow nodes
      const layoutedNodes = nodes.map(node => {
        const layoutNode = layoutedGraph.children.find(n => n.id === node.id);
        return {
          ...node,
          position: {
            x: layoutNode ? layoutNode.x : node.position.x,
            y: layoutNode ? layoutNode.y : node.position.y
          }
        };
      });

      return { layoutedNodes, layoutedEdges: edges };
    } catch (err) {
      console.error('ELK Layout Error:', err);
      return { layoutedNodes: nodes, layoutedEdges: edges }; // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  return { getLayout, loadingLayout: loading };
}
