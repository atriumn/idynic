# Delete My Account - Implementation Plan

> Created 2025-12-28

**Status:** Done

## Progress (Last reviewed: 2025-12-30)

✅ Fully implemented. DELETE /api/v1/account endpoint, delete-account-modal.tsx, unit tests.

## Overview

GDPR-compliant account deletion that removes all user data across the platform. Must handle cascading deletes, storage cleanup, and Stripe subscription cancellation.

## Database Tables to Delete

All tables with `user_id` foreign key (in deletion order to respect constraints):

### Phase 1: Cancel External Services
- Stripe subscription (if `stripe_subscription_id` exists)

### Phase 2: Delete Storage Files
- `resumes` bucket: All files under `{user_id}/` prefix

### Phase 3: Delete Database Records

**Order matters due to foreign keys:**

1. `shared_link_views` (via shared_links → tailored_profiles)
2. `shared_links`
3. `tailored_profiles`
4. `matches`
5. `opportunity_notes`
6. `opportunities`
7. `claim_evidence` (junction table)
8. `claims`
9. `evidence`
10. `work_history`
11. `document_jobs`
12. `documents`
13. `identity_claims`
14. `api_keys`
15. `usage_tracking`
16. `ai_usage_log`
17. `subscriptions`
18. `profiles` (deletes auth.users via cascade)

**Note:** Most cascades are handled by FK constraints, but we delete explicitly for auditability.

### Phase 4: Delete Auth User
- `supabase.auth.admin.deleteUser(user_id)`

---

## API Endpoint

### `DELETE /api/v1/account`

**Authentication:** Bearer token (JWT or API key)

**Request Body:**
```typescript
interface DeleteAccountRequest {
  password: string;  // Required for verification
  confirmation: string;  // Must equal "DELETE MY ACCOUNT"
}
```

**Response:**
- `204 No Content` - Success
- `400 Bad Request` - Missing/invalid confirmation
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Password verification failed
- `500 Internal Server Error` - Deletion failed

**Implementation:**

```typescript
// apps/web/src/app/api/v1/account/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service-role";
import { stripe } from "@/lib/billing/stripe";
import { apiError } from "@/lib/api/response";

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  const body = await request.json();

  // 1. Validate confirmation text
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return apiError("invalid_confirmation", "Confirmation text must be exactly 'DELETE MY ACCOUNT'", 400);
  }

  // 2. Verify password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.password,
  });

  if (signInError) {
    return apiError("invalid_password", "Password verification failed", 403);
  }

  const serviceClient = createServiceClient();

  try {
    // 3. Cancel Stripe subscription if exists
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (subscription?.stripe_subscription_id) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    }

    // 4. Delete storage files
    const { data: files } = await serviceClient.storage
      .from("resumes")
      .list(user.id);

    if (files?.length) {
      const filePaths = files.map(f => `${user.id}/${f.name}`);
      await serviceClient.storage.from("resumes").remove(filePaths);
    }

    // 5. Delete database records (explicit for auditability)
    // Most will cascade, but we ensure complete cleanup

    // Delete tailored_profiles related data
    await serviceClient.from("shared_link_views")
      .delete()
      .in("shared_link_id",
        serviceClient.from("shared_links").select("id").eq("user_id", user.id)
      );
    await serviceClient.from("shared_links").delete().eq("user_id", user.id);
    await serviceClient.from("tailored_profiles").delete().eq("user_id", user.id);

    // Delete opportunity related data
    await serviceClient.from("matches").delete().eq("user_id", user.id);
    await serviceClient.from("opportunity_notes").delete().eq("user_id", user.id);
    await serviceClient.from("opportunities").delete().eq("user_id", user.id);

    // Delete evidence and claims
    await serviceClient.from("claim_evidence").delete()
      .in("claim_id",
        serviceClient.from("claims").select("id").eq("user_id", user.id)
      );
    await serviceClient.from("claims").delete().eq("user_id", user.id);
    await serviceClient.from("evidence").delete().eq("user_id", user.id);

    // Delete work history and documents
    await serviceClient.from("work_history").delete().eq("user_id", user.id);
    await serviceClient.from("document_jobs").delete().eq("user_id", user.id);
    await serviceClient.from("documents").delete().eq("user_id", user.id);

    // Delete identity and settings
    await serviceClient.from("identity_claims").delete().eq("user_id", user.id);
    await serviceClient.from("api_keys").delete().eq("user_id", user.id);
    await serviceClient.from("usage_tracking").delete().eq("user_id", user.id);
    await serviceClient.from("ai_usage_log").delete().eq("user_id", user.id);
    await serviceClient.from("subscriptions").delete().eq("user_id", user.id);

    // Delete profile (this may cascade remaining records)
    await serviceClient.from("profiles").delete().eq("id", user.id);

    // 6. Delete auth user
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      // Profile already deleted, so we continue
    }

    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error("Account deletion failed:", error);
    return apiError("deletion_failed", "Failed to delete account", 500);
  }
}
```

---

## UI Components

### Settings Navigation Update

Add new nav item in `apps/web/src/app/settings/layout.tsx`:

```typescript
const settingsNav = [
  { title: "Usage & Billing", href: "/settings/usage", icon: BarChart3 },
  { title: "API Keys", href: "/settings/api-keys", icon: Key },
  { title: "Account", href: "/settings/account", icon: User },  // NEW
];
```

### Account Settings Page

Create `apps/web/src/app/settings/account/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Trash2 } from "lucide-react";
import { DeleteAccountModal } from "./delete-account-modal";
import { ExportDataButton } from "./export-data-button";

export default function AccountSettingsPage() {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground">Manage your account data</p>
      </div>

      {/* Export Data Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data including your profile, work history,
            skills, opportunities, and uploaded documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportDataButton />
        </CardContent>
      </Card>

      {/* Delete Account Section */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete My Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
      />
    </div>
  );
}
```

### Delete Account Modal

Create `apps/web/src/app/settings/account/delete-account-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = password.length > 0 && confirmation === "DELETE MY ACCOUNT";

  const handleDelete = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/v1/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      toast.success("Account deleted successfully");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmation("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete your account and all data including:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mb-4">
          <li>Your profile and identity information</li>
          <li>All uploaded resumes and documents</li>
          <li>Work history and evidence</li>
          <li>Opportunities and tailored profiles</li>
          <li>API keys and usage data</li>
          <li>Your subscription (will be cancelled)</li>
        </ul>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Enter your password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-mono font-semibold">DELETE MY ACCOUNT</span> to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isValid || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete Account
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Edge Cases

### 1. Active Subscription
- Cancel Stripe subscription immediately (not at period end)
- Webhook may fire after user deleted - handle gracefully
- Consider: Prorate refund? (Business decision)

### 2. OAuth Users (No Password)
- Check if user has password set
- If OAuth-only, use alternative verification (re-auth with provider)
- Or: Send confirmation email with one-time link

### 3. Partial Deletion Failure
- If storage deletion fails, still proceed with DB deletion
- Log failures for manual cleanup
- Consider: Retry queue for storage cleanup

### 4. Concurrent Requests
- First request wins, subsequent get 404 (user already deleted)
- Rate limit endpoint: 1 request per minute

### 5. API Key Used for Deletion
- Allow deletion via API key (user may be programmatically cleaning up)
- API key is deleted along with account

---

## Security Considerations

1. **Password Verification** - Prevents unauthorized deletion if session is hijacked
2. **Confirmation Text** - Prevents accidental deletion
3. **Service Role Client** - Required to bypass RLS for complete deletion
4. **Audit Logging** - Log deletion timestamp and IP (before deleting user)
5. **Rate Limiting** - Prevent brute-force password attempts

---

## Testing

### Unit Tests
- Password verification failure returns 403
- Missing confirmation returns 400
- Successful deletion returns 204

### Integration Tests
- Verify all tables are empty after deletion
- Verify storage files are removed
- Verify Stripe subscription is cancelled
- Verify auth user is deleted

### Manual Testing
- Delete account with active subscription
- Delete account with multiple documents
- Delete account with shared links (verify views cascade)

---

## Files to Create/Modify

### New Files
- `apps/web/src/app/api/v1/account/route.ts`
- `apps/web/src/app/settings/account/page.tsx`
- `apps/web/src/app/settings/account/delete-account-modal.tsx`
- `apps/web/src/app/settings/account/export-data-button.tsx`

### Modified Files
- `apps/web/src/app/settings/layout.tsx` - Add Account nav item

---

## Implementation Checklist

- [ ] Create `DELETE /api/v1/account` endpoint
- [ ] Add password verification
- [ ] Implement Stripe subscription cancellation
- [ ] Implement storage file deletion
- [ ] Implement database record deletion (all tables)
- [ ] Implement auth user deletion
- [ ] Add Account nav item to settings layout
- [ ] Create Account settings page
- [ ] Create Delete Account modal
- [ ] Add confirmation email after deletion (optional)
- [ ] Write tests
- [ ] Document env vars (none new required)
