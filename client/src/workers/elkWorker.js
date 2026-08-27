import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (event) => {
  const { id, graph } = event.data;
  try {
    const layoutedGraph = await elk.layout(graph);
    self.postMessage({ id, type: 'SUCCESS', layoutedGraph });
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', message: error?.message || 'Layout calculation failed' });
  }
};
