import { useState, useCallback } from 'react';

export function useSps() {
  const [sps, setSps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sps');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch SPs');
      }
      
      setSps(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sps, loading, error, fetchSps, setSps };
}
