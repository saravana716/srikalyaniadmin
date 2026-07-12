import { useState, useCallback } from 'react';

/**
 * Wrap async handlers with a shared loading flag (prevents double-submit).
 */
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (fn) => {
    if (loading) return;
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { loading, run };
}
