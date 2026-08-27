import { useState, useCallback } from 'react';

export function useSchema() {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch schema');
      setSchema(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSchema = useCallback((newSchema) => {
    setSchema(newSchema);
    setError(null);
  }, []);

  return {
    schema,
    loading,
    error,
    fetchSchema,
    updateSchema
  };
}
