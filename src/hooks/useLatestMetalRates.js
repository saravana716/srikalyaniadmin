import { useEffect, useState } from 'react';
import { subscribeLatestMetalRates } from '../services/goldRatesService';

/**
 * Latest gold/silver rates from Gold Rate Manage.
 */
export function useLatestMetalRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeLatestMetalRates((latest) => {
      setRates(latest);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { rates, loading };
}
