import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: api.profile.get,
  });
}
