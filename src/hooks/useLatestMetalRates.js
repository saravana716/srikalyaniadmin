import { useEffect, useState } from 'react';
import { subscribeLatestMetalRates } from '../services/goldRatesService';

/**
 * Latest gold/silver rates from Gold Rate Manage.
 */
export function useLatestMetalRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const unsub = subscribeLatestMetalRates((latest) => {
      if (isMounted) {
        setRates(latest);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
      if (typeof unsub === 'function') {
        unsub();
      }
    };
  }, []);

  return { rates, loading };
}
