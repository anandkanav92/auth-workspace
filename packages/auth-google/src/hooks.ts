import { useState, useEffect } from 'react';
import { onAuthChange } from './auth';
import type { AuthUser } from './types';

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
