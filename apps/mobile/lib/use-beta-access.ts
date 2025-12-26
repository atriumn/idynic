import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

interface BetaAccess {
  hasAccess: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useBetaAccess(): BetaAccess {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAccess = async () => {
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('beta_code_used')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[BetaAccess] Error checking access:', error.message);
        // If no profile exists yet, they don't have access
        setHasAccess(false);
      } else {
        setHasAccess(!!data?.beta_code_used);
      }
    } catch (e) {
      console.error('[BetaAccess] Exception:', e);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, [user?.id]);

  return {
    hasAccess,
    loading,
    refetch: checkAccess,
  };
}
