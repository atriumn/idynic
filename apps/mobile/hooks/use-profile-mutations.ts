import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
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
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  entry_type?: 'work' | 'venture' | 'additional';
}

export function useAddWorkHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WorkHistoryData) => {
      return api.workHistory.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUpdateWorkHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<WorkHistoryData, 'entry_type'>> }) => {
      return api.workHistory.update(id, data);
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
      return api.workHistory.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Education
export interface EducationData {
  text: string;
}

export function useAddEducation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EducationData) => {
      return api.education.create(data);
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
      return api.education.update(id, data);
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
      return api.education.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Skills
export function useAddSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: string) => {
      return api.skills.create(label);
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
      return api.skills.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['identity-claims'] });
    },
  });
}

// Ventures (same as work history but with entry_type='venture')
export function useAddVenture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<WorkHistoryData, 'entry_type'>) => {
      return api.workHistory.create({
        ...data,
        entry_type: 'venture',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
