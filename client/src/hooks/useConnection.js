import { useState, useCallback, useEffect } from 'react';

export function useConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [currentDatabase, setCurrentDatabase] = useState('');

  // Check initial status on mount
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data && data.connected) {
          setIsConnected(true);
          if (data.currentDatabase) {
            setCurrentDatabase(data.currentDatabase);
          }
          // fetch databases
          return fetch('/api/databases');
        } else {
          setIsConnected(false);
          setDatabases([]);
          setCurrentDatabase('');
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
    switchDatabase
  };
}
