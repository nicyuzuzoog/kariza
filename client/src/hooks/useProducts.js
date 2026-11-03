import { useCallback, useEffect, useState } from 'react';
import api from '../services/api.js';

/**
 * Loads the active product catalogue for transaction forms. Pages fetch a
 * maximum of 100 records each, so this walks up to five pages for larger
 * schools without blocking the UI if the catalogue is huge.
 */
export default function useProducts({ activeOnly = true } = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const collected = [];
      let page = 1;
      let pages = 1;
      do {
        const { data } = await api.get('/products', {
          params: {
            page,
            limit: 100,
            status: activeOnly ? 'all' : 'archived',
            includeArchived: activeOnly ? undefined : 'true',
            sort: 'name',
          },
        });
        collected.push(...(data.items || []));
        pages = data.pages || 1;
        page += 1;
      } while (page <= pages && page <= 5);

      setProducts(collected.filter((product) => product.isActive));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not load products');
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, error, reload: load };
}
