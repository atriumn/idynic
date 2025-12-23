'use server';

import { createClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api/keys';
import { revalidatePath } from 'next/cache';

export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
}

export async function listApiKeys(): Promise<ApiKeyListItem[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, expires_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch API keys');
  }

  return data || [];
}

export interface CreateApiKeyResult {
  id: string;
  key: string; // Full key, shown only once
  prefix: string;
}

export async function createApiKey(name: string): Promise<CreateApiKeyResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('Name is required');
  }

  const { key, hash, prefix } = generateApiKey();

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      name: name.trim(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error('Failed to create API key');
  }

  revalidatePath('/settings/api-keys');

  return {
    id: data.id,
    key,
    prefix,
  };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error('Failed to revoke API key');
  }

  revalidatePath('/settings/api-keys');
}
