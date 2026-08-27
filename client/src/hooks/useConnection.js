import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'db_visual_saved_conn';

export function useConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [currentDatabase, setCurrentDatabase] = useState('');

  // Check initial status on mount — if server already has a pool, use it.
  // Otherwise, attempt to auto-reconnect from saved credentials.
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.connected) {
          setIsConnected(true);
          if (data.currentDatabase) {
            setCurrentDatabase(data.currentDatabase);
          }
          return fetch('/api/databases');
        } else {
          // Server doesn't have an active pool — try auto-reconnect
          setIsConnected(false);
          setDatabases([]);
          setCurrentDatabase('');
          autoReconnect();
          return null;
        }
      })
      .then(res => res ? res.json() : null)
      .then(data => {
        if (data && data.databases) {
          setDatabases(data.databases);
        }
      })
      .catch(err => {
        console.error('Failed to check status:', err);
        setIsConnected(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-reconnect using saved credentials
  const autoReconnect = useCallback(async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.server || !saved.user || !saved.password) return;

      setLoading(true);
      setError(null);

      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved)
      });
      const data = await res.json();

      if (res.ok) {
        setIsConnected(true);
        setDatabases(data.databases || []);
        setCurrentDatabase(data.currentDatabase || '');
      }
    } catch (err) {
      console.warn('Auto-reconnect failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async (config) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      
      setIsConnected(true);
      setDatabases(data.databases || []);
      setCurrentDatabase(data.currentDatabase || '');

      // Persist full connection config for auto-reconnect
      // (only for manual config, not connection strings)
      if (config.server) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          server: config.server,
          port: config.port || '1433',
          database: config.database || '',
          user: config.user,
          password: config.password
        }));
      }

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/disconnect', { method: 'POST' });
      setIsConnected(false);
      setDatabases([]);
      setCurrentDatabase('');
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const forgetConnection = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasSavedConnection = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const switchDatabase = useCallback(async (dbName) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/switch-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: dbName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Switch failed');
      setCurrentDatabase(data.currentDatabase || dbName);

      // Update saved connection database
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          saved.database = data.currentDatabase || dbName;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        }
      } catch {}

      return data.schema; // return new schema directly
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isConnected,
    loading,
    error,
    databases,
    currentDatabase,
    connect,
    disconnect,
    switchDatabase,
    forgetConnection,
    hasSavedConnection
  };
}
