# External API Phase 1: Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up API key infrastructure and core read endpoints for the external API.

**Status:** Done

## Progress (Last reviewed: 2025-12-26)

| Step | Status | Notes |
|------|--------|-------|
| api_keys table | ✅ Complete | Migration applied |
| TypeScript types | ✅ Complete | types.ts regenerated |
| API key utilities | ✅ Complete | src/lib/api/keys.ts |
| Auth middleware | ✅ Complete | src/lib/api/auth.ts |
| Response helpers | ✅ Complete | src/lib/api/response.ts |
| GET /api/v1/profile | ✅ Complete | |
| GET /api/v1/claims | ✅ Complete | |
| GET /api/v1/opportunities | ✅ Complete | |
| API key management UI | ✅ Complete | /settings/api-keys |
| Navigation link | ✅ Complete | Added to user dropdown |

**Architecture:** Add `api_keys` table with hashed keys mapped to users. Create auth middleware that validates keys and sets RLS context. Build UI for users to manage keys. Implement first three endpoints: `/api/v1/profile`, `/api/v1/claims`, `/api/v1/opportunities`.

**Tech Stack:** Next.js 14 API routes, Supabase PostgreSQL, TypeScript, Tailwind CSS, Radix UI

**Design Document:** `docs/plans/2025-12-19-external-api-mcp-design.md`

---

## Task 1: Create api_keys Table

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_api_keys.sql`

**Step 1: Create the migration file**

```sql
-- Create api_keys table for external API authentication
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  key_hash text not null,
  key_prefix text not null,
  name text not null,
  scopes text[] default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now(),

  constraint valid_key_prefix check (key_prefix ~ '^idn_[a-z0-9]{4}$')
);

-- Index for fast lookup by hash (only non-revoked keys)
create index api_keys_hash_idx on api_keys(key_hash) where revoked_at is null;

-- Index for listing user's keys
create index api_keys_user_id_idx on api_keys(user_id);

-- RLS policies
alter table api_keys enable row level security;

-- Users can only see their own keys
create policy "Users can view own api keys"
  on api_keys for select
  using (auth.uid() = user_id);

-- Users can create keys for themselves
create policy "Users can create own api keys"
  on api_keys for insert
  with check (auth.uid() = user_id);

-- Users can update own keys (for revoking)
create policy "Users can update own api keys"
  on api_keys for update
  using (auth.uid() = user_id);

-- Users can delete own keys
create policy "Users can delete own api keys"
  on api_keys for delete
  using (auth.uid() = user_id);
```

**Step 2: Apply the migration**

Run from worktree root:
```bash
supabase migration new create_api_keys
# Copy the SQL above into the created file
supabase db push
```

Expected: Migration applies successfully, table created.

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(api): add api_keys table for external API auth"
```

---

## Task 2: Generate Updated TypeScript Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Step 1: Generate types from Supabase**

```bash
supabase gen types typescript --local > src/lib/supabase/types.ts
```

**Step 2: Verify api_keys type exists**

Open `src/lib/supabase/types.ts` and confirm it contains:
```typescript
api_keys: {
  Row: {
    id: string
    user_id: string
    key_hash: string
    key_prefix: string
    name: string
    scopes: string[] | null
    last_used_at: string | null
    expires_at: string | null
    revoked_at: string | null
    created_at: string | null
  }
  // ... Insert and Update types
}
```

**Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "chore: regenerate Supabase types with api_keys"
```

---

## Task 3: Create API Key Utilities

**Files:**
- Create: `src/lib/api/keys.ts`

**Step 1: Create the key utilities file**

```typescript
import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'idn_';
const KEY_BYTES = 32;

/**
 * Generate a new API key.
 * Returns both the full key (to show user once) and the hash (to store).
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(KEY_BYTES).toString('hex');
  const key = `${KEY_PREFIX}${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = `${KEY_PREFIX}${randomPart.slice(0, 4)}`;

  return { key, hash, prefix };
}

/**
 * Hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format.
 */
export function isValidApiKeyFormat(key: string): boolean {
  // idn_ prefix + 64 hex chars
  return /^idn_[a-f0-9]{64}$/.test(key);
}
```

**Step 2: Verify the module compiles**

```bash
npx tsc --noEmit src/lib/api/keys.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api/keys.ts
git commit -m "feat(api): add API key generation and hashing utilities"
```

---

## Task 4: Create API Auth Middleware

**Files:**
- Create: `src/lib/api/auth.ts`

**Step 1: Create the auth middleware**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashApiKey, isValidApiKeyFormat } from './keys';

export interface ApiAuthResult {
  userId: string;
  keyId: string;
}

export interface ApiAuthError {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/**
 * Validate API key from Authorization header.
 * Returns user info if valid, error response if not.
 */
export async function validateApiKey(
  request: NextRequest
): Promise<ApiAuthResult | NextResponse<ApiAuthError>> {
  const requestId = crypto.randomUUID().slice(0, 8);

  // Extract Bearer token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'Missing or malformed Authorization header. Expected: Bearer idn_xxx',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  const key = authHeader.slice(7); // Remove 'Bearer '

  // Validate format
  if (!isValidApiKeyFormat(key)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'Invalid API key format',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Look up key in database
  const keyHash = hashApiKey(key);
  const supabase = await createClient();

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('id, user_id, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKey) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'API key not found or invalid',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Check if revoked
  if (apiKey.revoked_at) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_api_key',
          message: 'API key has been revoked',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Check if expired
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return NextResponse.json(
      {
        error: {
          code: 'expired_api_key',
          message: 'API key has expired',
          request_id: requestId,
        },
      },
      { status: 401 }
    );
  }

  // Update last_used_at (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {});

  return {
    userId: apiKey.user_id,
    keyId: apiKey.id,
  };
}

/**
 * Check if result is an error response.
 */
export function isAuthError(
  result: ApiAuthResult | NextResponse<ApiAuthError>
): result is NextResponse<ApiAuthError> {
  return result instanceof NextResponse;
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/lib/api/auth.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api/auth.ts
git commit -m "feat(api): add API key validation middleware"
```

---

## Task 5: Create API Response Helpers

**Files:**
- Create: `src/lib/api/response.ts`

**Step 1: Create response helpers**

```typescript
import { NextResponse } from 'next/server';

interface ApiMeta {
  request_id: string;
  count?: number;
  has_more?: boolean;
}

interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

/**
 * Create a standardized success response.
 */
export function apiSuccess<T>(
  data: T,
  options?: { count?: number; has_more?: boolean }
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = crypto.randomUUID().slice(0, 8);

  return NextResponse.json({
    data,
    meta: {
      request_id: requestId,
      ...(options?.count !== undefined && { count: options.count }),
      ...(options?.has_more !== undefined && { has_more: options.has_more }),
    },
  });
}

/**
 * Create a standardized error response.
 */
export function apiError(
  code: string,
  message: string,
  status: number = 400
): NextResponse<ApiErrorResponse> {
  const requestId = crypto.randomUUID().slice(0, 8);

  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    { status }
  );
}

/**
 * Common error responses.
 */
export const ApiErrors = {
  notFound: (resource: string) =>
    apiError('not_found', `${resource} not found`, 404),

  validationError: (message: string) =>
    apiError('validation_error', message, 400),

  serverError: (message: string = 'An unexpected error occurred') =>
    apiError('server_error', message, 500),
};
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/lib/api/response.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/api/response.ts
git commit -m "feat(api): add standardized API response helpers"
```

---

## Task 6: Create GET /api/v1/profile Endpoint

**Files:**
- Create: `src/app/api/v1/profile/route.ts`

**Step 1: Create the profile endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess, ApiErrors } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return ApiErrors.notFound('Profile');
  }

  // Fetch work history
  const { data: workHistory } = await supabase
    .from('work_history')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  // Fetch identity claims (for skills, education, certifications)
  const { data: claims } = await supabase
    .from('identity_claims')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  // Separate claims by type
  const skills = claims?.filter(c => c.type === 'skill') || [];
  const education = claims?.filter(c => c.type === 'education') || [];
  const certifications = claims?.filter(c => c.type === 'certification') || [];

  // Separate work history by type
  const experience = workHistory?.filter(w => w.entry_type === 'work') || [];
  const ventures = workHistory?.filter(w => w.entry_type === 'venture') || [];
  const additional = workHistory?.filter(w => w.entry_type === 'additional') || [];

  return apiSuccess({
    contact: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedin_url: profile.linkedin_url,
      github_url: profile.github_url,
      website_url: profile.website_url,
      logo_url: profile.logo_url,
    },
    experience,
    ventures,
    additional_experience: additional,
    skills: skills.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      confidence: s.confidence,
    })),
    education: education.map(e => ({
      id: e.id,
      label: e.label,
      description: e.description,
      confidence: e.confidence,
    })),
    certifications: certifications.map(c => ({
      id: c.id,
      label: c.label,
      description: c.description,
      confidence: c.confidence,
    })),
  });
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/api/v1/profile/route.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/v1/profile/
git commit -m "feat(api): add GET /api/v1/profile endpoint"
```

---

## Task 7: Create GET /api/v1/claims Endpoint

**Files:**
- Create: `src/app/api/v1/claims/route.ts`

**Step 1: Create the claims endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = await createClient();

  // Parse query params
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // Filter by type (skill, achievement, attribute, education, certification)

  // Build query
  let query = supabase
    .from('identity_claims')
    .select(`
      id,
      type,
      label,
      description,
      confidence,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data: claims, error } = await query;

  if (error) {
    console.error('Error fetching claims:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  return apiSuccess(claims || [], {
    count: claims?.length || 0,
    has_more: false,
  });
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/api/v1/claims/route.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/v1/claims/
git commit -m "feat(api): add GET /api/v1/claims endpoint"
```

---

## Task 8: Create GET /api/v1/opportunities Endpoint

**Files:**
- Create: `src/app/api/v1/opportunities/route.ts`

**Step 1: Create the opportunities endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateApiKey, isAuthError } from '@/lib/api/auth';
import { apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = await createClient();

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // Filter by status

  // Build query
  let query = supabase
    .from('opportunities')
    .select(`
      id,
      title,
      company,
      url,
      description,
      requirements,
      status,
      created_at,
      updated_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: opportunities, error } = await query;

  if (error) {
    console.error('Error fetching opportunities:', error);
    return apiSuccess([], { count: 0, has_more: false });
  }

  // TODO: Add match scores once matching logic is integrated
  // For now, return opportunities without scores

  return apiSuccess(
    opportunities?.map(o => ({
      ...o,
      match_score: null, // Placeholder for future match scoring
    })) || [],
    {
      count: opportunities?.length || 0,
      has_more: false,
    }
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/api/v1/opportunities/route.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/v1/opportunities/
git commit -m "feat(api): add GET /api/v1/opportunities endpoint"
```

---

## Task 9: Create API Key Management Server Actions

**Files:**
- Create: `src/app/settings/api-keys/actions.ts`

**Step 1: Create server actions for key management**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api/keys';
import { revalidatePath } from 'next/cache';

export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
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
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/settings/api-keys/actions.ts
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/settings/api-keys/
git commit -m "feat(api): add API key management server actions"
```

---

## Task 10: Create API Keys Management Page

**Files:**
- Create: `src/app/settings/api-keys/page.tsx`

**Step 1: Create the management page**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listApiKeys } from './actions';
import { ApiKeysClient } from './client';

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const keys = await listApiKeys();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for external access to your Idynic data.
          Use these keys with the Idynic MCP server or REST API.
        </p>
      </div>

      <ApiKeysClient initialKeys={keys} />
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/settings/api-keys/page.tsx
```

Expected: No errors (may show warning about missing ApiKeysClient - that's next).

**Step 3: Commit (with placeholder)**

```bash
git add src/app/settings/api-keys/page.tsx
git commit -m "feat(api): add API keys management page (server component)"
```

---

## Task 11: Create API Keys Client Component

**Files:**
- Create: `src/app/settings/api-keys/client.tsx`

**Step 1: Create the client component**

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createApiKey, revokeApiKey, type ApiKeyListItem } from './actions';
import { Copy, Key, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  initialKeys: ApiKeyListItem[];
}

export function ApiKeysClient({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const result = await createApiKey(newKeyName);
      setNewKey(result.key);
      setKeys(prev => [
        {
          id: result.id,
          name: newKeyName,
          key_prefix: result.prefix,
          created_at: new Date().toISOString(),
          last_used_at: null,
          expires_at: null,
        },
        ...prev,
      ]);
      setNewKeyName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await revokeApiKey(keyId);
      setKeys(prev => prev.filter(k => k.id !== keyId));
      toast({
        title: 'Key revoked',
        description: 'The API key has been revoked',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setNewKey(null);
            setNewKeyName('');
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Key className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
              <DialogDescription>
                {newKey
                  ? 'Copy this key now. You won\'t be able to see it again.'
                  : 'Give your API key a name to help you remember what it\'s for.'}
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {newKey}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(newKey)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsCreateOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  placeholder="e.g., Claude Desktop, Personal MCP"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <DialogFooter>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName.trim() || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
          <p className="text-muted-foreground mb-4">
            Create an API key to start using the Idynic API or MCP server.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {key.key_prefix}...
                </TableCell>
                <TableCell>{formatDate(key.created_at)}</TableCell>
                <TableCell>{formatDate(key.last_used_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRevoke(key.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">Using your API key</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Add the key to your Claude Desktop configuration:
        </p>
        <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "mcpServers": {
    "idynic": {
      "command": "npx",
      "args": ["@idynic/mcp-server"],
      "env": {
        "IDYNIC_API_KEY": "idn_your_key_here"
      }
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/app/settings/api-keys/client.tsx
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/settings/api-keys/client.tsx
git commit -m "feat(api): add API keys management client component"
```

---

## Task 12: Add Settings Link to Navigation

**Files:**
- Modify: `src/components/nav.tsx` (find the user dropdown section)

**Step 1: Add link to API Keys page**

Find the user dropdown menu in `nav.tsx` and add a link to API Keys. Look for the dropdown with Profile and Shared Links, add after them:

```tsx
<DropdownMenuItem asChild>
  <Link href="/settings/api-keys">
    <Key className="mr-2 h-4 w-4" />
    API Keys
  </Link>
</DropdownMenuItem>
```

Also add the import at the top:
```tsx
import { Key } from 'lucide-react';
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/components/nav.tsx
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat(nav): add API Keys link to user dropdown"
```

---

## Task 13: Final Integration Test

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Manual verification checklist**

1. Navigate to `/settings/api-keys`
2. Create a new API key
3. Verify the key is displayed and can be copied
4. Close the dialog and verify key appears in table
5. Revoke the key and verify it's removed

**Step 3: Test API endpoints with curl**

```bash
# Replace with your actual API key
API_KEY="idn_your_key_here"

# Test profile endpoint
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/v1/profile

# Test claims endpoint
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/v1/claims

# Test opportunities endpoint
curl -H "Authorization: Bearer $API_KEY" http://localhost:3000/api/v1/opportunities

# Test invalid key
curl -H "Authorization: Bearer idn_invalid" http://localhost:3000/api/v1/profile
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(api): complete Phase 1 - API key infrastructure and core endpoints"
```

---

## Summary

Phase 1 delivers:
- `api_keys` table with RLS policies
- API key generation and hashing utilities
- Auth middleware for API key validation
- Standardized response helpers
- Three core endpoints: `/api/v1/profile`, `/api/v1/claims`, `/api/v1/opportunities`
- API key management UI at `/settings/api-keys`
- Navigation link to API keys page

Next: Phase 2 - Opportunity Operations (POST opportunities, match analysis, tailoring, sharing)
