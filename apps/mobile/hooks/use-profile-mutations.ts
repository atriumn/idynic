// @ts-nocheck - TODO: Regenerate Supabase types to fix these mismatches
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';

// Contact info update
export interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export function useUpdateContact() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ContactData) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Work History
export interface WorkHistoryData {
  company: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  entry_type?: 'work' | 'venture' | 'additional';
}

export function useAddWorkHistory() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WorkHistoryData) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      // Get current max order_index
      const { data: existing } = await supabase
        .from('work_history')
        .select('order_index')
        .eq('user_id', session.user.id)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextIndex = existing?.[0]?.order_index != null ? existing[0].order_index + 1 : 0;

      const { error } = await supabase.from('work_history').insert({
        ...data,
        user_id: session.user.id,
        order_index: nextIndex,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateWorkHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WorkHistoryData> }) => {
      const { error } = await supabase
        .from('work_history')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeleteWorkHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_history').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Education
export interface EducationData {
  text: string;
  context?: unknown;
}

export function useAddEducation() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EducationData) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('evidence').insert({
        ...data,
        user_id: session.user.id,
        evidence_type: 'education',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EducationData> }) => {
      const { error } = await supabase.from('evidence').update(data).eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeleteEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evidence').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Skills
export function useAddSkill() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: string) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('identity_claims').insert({
        user_id: session.user.id,
        type: 'skill',
        label,
        confidence: 1.0,
        source: 'manual',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['identity-claims'] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('identity_claims').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['identity-claims'] });
    },
  });
}

// Ventures (same as work history but with entry_type='venture')
export function useAddVenture() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<WorkHistoryData, 'entry_type'>) => {
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('work_history')
        .select('order_index')
        .eq('user_id', session.user.id)
        .eq('entry_type', 'venture')
        .order('order_index', { ascending: false })
        .limit(1);

      const nextIndex = existing?.[0]?.order_index != null ? existing[0].order_index + 1 : 0;

      const { error } = await supabase.from('work_history').insert({
        ...data,
        user_id: session.user.id,
        entry_type: 'venture',
        order_index: nextIndex,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
