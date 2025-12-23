import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

export interface SharedLink {
  id: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  tailoredProfileId: string;
  opportunity: {
    id: string;
    title: string | null;
    company: string | null;
  };
  viewCount: number;
}

interface SharedLinkDbResult {
  id: string;
  token: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  tailored_profile_id: string;
  tailored_profiles: {
    id: string;
    opportunity_id: string;
    opportunities: {
      id: string;
      title: string | null;
      company: string | null;
    };
  };
  shared_link_views: { id: string }[] | null;
}

async function fetchSharedLinks(userId: string): Promise<SharedLink[]> {
  const { data, error } = await supabase
    .from('shared_links')
    .select(`
      id,
      token,
      expires_at,
      revoked_at,
      created_at,
      tailored_profile_id,
      tailored_profiles!inner (
        id,
        opportunity_id,
        opportunities!inner (
          id,
          title,
          company
        )
      ),
      shared_link_views (
        id
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const links = data as unknown as SharedLinkDbResult[];

  return links.map((link) => ({
    id: link.id,
    token: link.token,
    expiresAt: link.expires_at,
    revokedAt: link.revoked_at,
    createdAt: link.created_at,
    tailoredProfileId: link.tailored_profile_id,
    opportunity: {
      id: link.tailored_profiles.opportunities.id,
      title: link.tailored_profiles.opportunities.title,
      company: link.tailored_profiles.opportunities.company,
    },
    viewCount: link.shared_link_views?.length || 0,
  }));
}

export function useSharedLinks() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['shared-links', session?.user?.id],
    queryFn: () => {
      if (!session?.user?.id) throw new Error('Not authenticated');
      return fetchSharedLinks(session.user.id);
    },
    enabled: !!session?.user?.id,
  });
}

function generateToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface CreateSharedLinkParams {
  tailoredProfileId: string;
  expiresInDays?: number;
}

interface CreateSharedLinkResult {
  id: string;
  token: string;
  expiresAt: string;
  url: string;
}

export function useCreateSharedLink() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tailoredProfileId,
      expiresInDays = 30,
    }: CreateSharedLinkParams): Promise<CreateSharedLinkResult> => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      // Check if link already exists for this profile
      const { data: existingLink } = await supabase
        .from('shared_links')
        .select('id, token, expires_at')
        .eq('tailored_profile_id', tailoredProfileId)
        .eq('user_id', session.user.id)
        .is('revoked_at', null)
        .single();

      if (existingLink) {
        // Return existing link
        return {
          id: existingLink.id,
          token: existingLink.token,
          expiresAt: existingLink.expires_at,
          url: `https://idynic.com/shared/${existingLink.token}`,
        };
      }

      // Calculate expiration
      const expiresAt = new Date();
      if (expiresInDays > 0) {
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      } else {
        // "No expiration" = 10 years
        expiresAt.setFullYear(expiresAt.getFullYear() + 10);
      }

      const token = generateToken();

      const { data: newLink, error } = await supabase
        .from('shared_links')
        .insert({
          tailored_profile_id: tailoredProfileId,
          user_id: session.user.id,
          token,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: newLink.id,
        token: newLink.token,
        expiresAt: newLink.expires_at,
        url: `https://idynic.com/shared/${newLink.token}`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-links'] });
    },
  });
}

export function useRevokeSharedLink() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shared_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', linkId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-links'] });
    },
  });
}

export function useDeleteSharedLink() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shared_links')
        .delete()
        .eq('id', linkId)
        .eq('user_id', session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-links'] });
    },
  });
}

// Check if a shared link exists for an opportunity
export function useSharedLinkForOpportunity(opportunityId: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['shared-link-for-opportunity', opportunityId, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      // First get the tailored profile for this opportunity
      const { data: profile } = await supabase
        .from('tailored_profiles')
        .select('id')
        .eq('opportunity_id', opportunityId)
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return null;

      // Then check for existing link
      const { data: link } = await supabase
        .from('shared_links')
        .select('id, token, expires_at, revoked_at')
        .eq('tailored_profile_id', profile.id)
        .eq('user_id', session.user.id)
        .is('revoked_at', null)
        .single();

      if (!link) return null;

      return {
        id: link.id,
        token: link.token,
        expiresAt: link.expires_at,
        url: `https://idynic.com/shared/${link.token}`,
      };
    },
    enabled: !!session?.user?.id && !!opportunityId,
  });
}
