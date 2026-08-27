import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import './index.css'
import App from './App.jsx'

ModuleRegistry.registerModules([AllCommunityModule]);

// Global resilient fetch wrapper for robust auth and connection persistence
const originalFetch = window.fetch;
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url || '');
  
  if (url.includes('/api/')) {
    init = init || {};
    init.credentials = init.credentials || 'include';
    
    // Normalize headers
    let headersObj = {};
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => { headersObj[k] = v; });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([k, v]) => { headersObj[k] = v; });
    } else if (init.headers) {
      headersObj = { ...init.headers };
    }

    const token = localStorage.getItem('db_auth_token');
    if (token && !headersObj['Authorization'] && !headersObj['authorization']) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }

    const cid = localStorage.getItem('db_connection_id');
    if (cid && !headersObj['x-db-connection-id']) {
      headersObj['x-db-connection-id'] = cid;
    }

    init.headers = headersObj;

    const response = await originalFetch(input, init);

    // Auto-capture token on login
    if (url.includes('/api/login') && response.ok) {
      try {
        const clone = response.clone();
        clone.json().then(data => {
          if (data && data.token) {
            localStorage.setItem('db_auth_token', data.token);
          }
        }).catch(() => {});
      } catch (e) {}
    }

    // Auto-capture CID on connect
    if (url.includes('/api/connect') && response.ok) {
      try {
        const clone = response.clone();
        clone.json().then(data => {
          if (data && data.cid) {
            localStorage.setItem('db_connection_id', data.cid);
          }
        }).catch(() => {});
      } catch (e) {}
    }

    // Clear session on logout
    if (url.includes('/api/logout')) {
      localStorage.removeItem('db_auth_token');
      localStorage.removeItem('db_connection_id');
    }
    if (url.includes('/api/disconnect')) {
      localStorage.removeItem('db_connection_id');
    }

    return response;
  }

  return originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
