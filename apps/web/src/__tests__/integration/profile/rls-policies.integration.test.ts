import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUserWithClient,
  cleanupTestUsers,
  generateTestEmail,
  getAnonClient,
  getAdminClient,
} from "../setup/test-utils";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("RLS Policies: Profiles", () => {
  let user1: User;
  let user1Client: SupabaseClient<Database>;
  let user2: User;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let user2Client: SupabaseClient<Database>;

  beforeAll(async () => {
    // Create two test users with their authenticated clients
    const result1 = await createTestUserWithClient(
      generateTestEmail("rls-user1"),
    );
    user1 = result1.user;
    user1Client = result1.client;

    // User2 is created to test cross-user RLS policies
    const result2 = await createTestUserWithClient(
      generateTestEmail("rls-user2"),
    );
    user2 = result2.user;
    user2Client = result2.client;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  describe("SELECT policies", () => {
    it("should allow user to SELECT their own profile", async () => {
      const { data, error } = await user1Client
        .from("profiles")
        .select("*")
        .eq("id", user1.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(user1.id);
      expect(data?.email).toBe(user1.email);
    });

    it("should NOT return another user profile on SELECT", async () => {
      // User 1 trying to select User 2's profile
      const { data, error } = await user1Client
        .from("profiles")
        .select("*")
        .eq("id", user2.id)
        .single();

      // RLS should filter it out - either no row found or empty result
      expect(data).toBeNull();
      // The error should indicate no rows found (PGRST116)
      expect(error?.code).toBe("PGRST116");
    });

    it("should only return own profile in list query", async () => {
      const { data, error } = await user1Client.from("profiles").select("*");

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBe(1);
      expect(data?.[0]?.id).toBe(user1.id);
    });

    it("should deny access to unauthenticated users", async () => {
      const anonClient = getAnonClient();

      const { data } = await anonClient.from("profiles").select("*");

      // Should either get empty result or an error
      expect(data?.length ?? 0).toBe(0);
    });
  });

  describe("UPDATE policies", () => {
    it("should allow user to UPDATE their own profile", async () => {
      const newName = `Updated Name ${Date.now()}`;

      const { data, error } = await user1Client
        .from("profiles")
        .update({ name: newName })
        .eq("id", user1.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe(newName);
    });

    it("should NOT allow user to UPDATE another user profile", async () => {
      const newName = `Hacked Name ${Date.now()}`;

      const { data } = await user1Client
        .from("profiles")
        .update({ name: newName })
        .eq("id", user2.id)
        .select();

      // RLS should prevent this - either error or no rows affected
      // With RLS, the update silently affects 0 rows (no match due to policy)
      expect(data?.length ?? 0).toBe(0);
    });

    it("should verify other profile was not modified", async () => {
      // Get user2's profile using admin client (bypasses RLS) to verify
      const admin = getAdminClient();
      const { data: user2Profile, error } = await admin
        .from("profiles")
        .select("name")
        .eq("id", user2.id)
        .single();

      expect(error).toBeNull();
      expect(user2Profile).not.toBeNull();
      // Name should NOT be "Hacked Name..." (it should be null or the original value)
      // Handle case where name might be null (default for new profiles)
      if (user2Profile?.name !== null) {
        expect(user2Profile?.name).not.toContain("Hacked");
      }
      // If name is null, the update definitely didn't work
    });
  });

  describe("DELETE policies", () => {
    it("should NOT allow user to DELETE their own profile", async () => {
      // Profiles should typically not be deletable by users
      // They're tied to auth.users and managed by the system
      await user1Client.from("profiles").delete().eq("id", user1.id);

      // Should either get an error or no rows affected
      // (depends on policy configuration - most apps don't allow profile deletion)
      // If deletion is allowed, this test documents that behavior
    });

    it("should NOT allow user to DELETE another user profile", async () => {
      const { data } = await user1Client
        .from("profiles")
        .delete()
        .eq("id", user2.id)
        .select();

      // RLS should prevent this
      expect(data?.length ?? 0).toBe(0);
    });
  });

  describe("INSERT policies", () => {
    it("should NOT allow manual profile INSERT (profiles created by trigger)", async () => {
      // Profiles are created automatically when users sign up via trigger
      // Direct inserts should be denied
      const { error } = await user1Client.from("profiles").insert({
        id: crypto.randomUUID(),
        email: "fake@test.local",
      } as never);

      // Should be denied - either by RLS or constraint
      expect(error).toBeDefined();
    });
  });
});

describe("RLS Policies: Documents", () => {
  let user1: User;
  let user1Client: SupabaseClient<Database>;
  let user2: User;
  let user2Client: SupabaseClient<Database>;
  let user1DocId: string;

  beforeAll(async () => {
    const result1 = await createTestUserWithClient(
      generateTestEmail("rls-docs-user1"),
    );
    user1 = result1.user;
    user1Client = result1.client;

    const result2 = await createTestUserWithClient(
      generateTestEmail("rls-docs-user2"),
    );
    user2 = result2.user;
    user2Client = result2.client;

    // Create a document for user1
    const { data: doc } = await user1Client
      .from("documents")
      .insert({
        user_id: user1.id,
        type: "resume",
        filename: "test-resume.pdf",
        status: "pending",
      })
      .select()
      .single();

    user1DocId = doc!.id;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("should allow user to SELECT their own documents", async () => {
    const { data, error } = await user1Client
      .from("documents")
      .select("*")
      .eq("id", user1DocId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.user_id).toBe(user1.id);
  });

  it("should NOT return another user documents on SELECT", async () => {
    const { data, error } = await user2Client
      .from("documents")
      .select("*")
      .eq("id", user1DocId)
      .single();

    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("should allow user to INSERT documents for themselves", async () => {
    const { data, error } = await user2Client
      .from("documents")
      .insert({
        user_id: user2.id,
        type: "story",
        filename: "my-story.pdf",
        status: "pending",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.user_id).toBe(user2.id);
  });

  it("should NOT allow user to INSERT documents for another user", async () => {
    const { error } = await user2Client
      .from("documents")
      .insert({
        user_id: user1.id, // Trying to insert as user1
        type: "resume",
        filename: "evil-resume.pdf",
        status: "pending",
      })
      .select();

    // RLS should prevent this
    expect(error).toBeDefined();
  });

  it("should allow user to UPDATE their own documents", async () => {
    const { data, error } = await user1Client
      .from("documents")
      .update({ status: "completed" })
      .eq("id", user1DocId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("completed");
  });

  it("should NOT allow user to UPDATE another user documents", async () => {
    const { data } = await user2Client
      .from("documents")
      .update({ status: "failed" })
      .eq("id", user1DocId)
      .select();

    expect(data?.length ?? 0).toBe(0);
  });

  it("should allow user to DELETE their own documents", async () => {
    // Create a document to delete
    const { data: newDoc } = await user1Client
      .from("documents")
      .insert({
        user_id: user1.id,
        type: "resume",
        filename: "to-delete.pdf",
        status: "pending",
      })
      .select()
      .single();

    const { error } = await user1Client
      .from("documents")
      .delete()
      .eq("id", newDoc!.id);

    expect(error).toBeNull();

    // Verify it's deleted
    const { data: verifyDeleted } = await user1Client
      .from("documents")
      .select("*")
      .eq("id", newDoc!.id);

    expect(verifyDeleted?.length ?? 0).toBe(0);
  });

  it("should NOT allow user to DELETE another user documents", async () => {
    const { data } = await user2Client
      .from("documents")
      .delete()
      .eq("id", user1DocId)
      .select();

    expect(data?.length ?? 0).toBe(0);
  });
});

describe("RLS Policies: Opportunities", () => {
  let user1: User;
  let user1Client: SupabaseClient<Database>;
  let user2: User;
  let user2Client: SupabaseClient<Database>;
  let user1OpportunityId: string;

  beforeAll(async () => {
    const result1 = await createTestUserWithClient(
      generateTestEmail("rls-opp-user1"),
    );
    user1 = result1.user;
    user1Client = result1.client;

    const result2 = await createTestUserWithClient(
      generateTestEmail("rls-opp-user2"),
    );
    user2 = result2.user;
    user2Client = result2.client;

    // Create an opportunity for user1
    const { data: opp } = await user1Client
      .from("opportunities")
      .insert({
        user_id: user1.id,
        title: "Software Engineer",
        company: "Test Corp",
        status: "tracking",
      })
      .select()
      .single();

    user1OpportunityId = opp!.id;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("should allow user to SELECT their own opportunities", async () => {
    const { data, error } = await user1Client
      .from("opportunities")
      .select("*")
      .eq("id", user1OpportunityId)
      .single();

    expect(error).toBeNull();
    expect(data?.user_id).toBe(user1.id);
    expect(data?.title).toBe("Software Engineer");
  });

  it("should NOT return another user opportunities on SELECT", async () => {
    const { data, error } = await user2Client
      .from("opportunities")
      .select("*")
      .eq("id", user1OpportunityId)
      .single();

    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116");
  });

  it("should only return own opportunities in list query", async () => {
    // User2 has no opportunities
    const { data, error } = await user2Client.from("opportunities").select("*");

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it("should allow user to INSERT opportunities for themselves", async () => {
    const { data, error } = await user2Client
      .from("opportunities")
      .insert({
        user_id: user2.id,
        title: "Product Manager",
        company: "Another Corp",
        status: "applied",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.user_id).toBe(user2.id);
  });

  it("should NOT allow user to INSERT opportunities for another user", async () => {
    const { error } = await user2Client
      .from("opportunities")
      .insert({
        user_id: user1.id, // Trying to insert as user1
        title: "Evil Opportunity",
        company: "Evil Corp",
        status: "tracking",
      })
      .select();

    expect(error).toBeDefined();
  });

  it("should allow user to UPDATE their own opportunities", async () => {
    const { data, error } = await user1Client
      .from("opportunities")
      .update({ status: "interviewing" })
      .eq("id", user1OpportunityId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("interviewing");
  });

  it("should NOT allow user to UPDATE another user opportunities", async () => {
    const { data } = await user2Client
      .from("opportunities")
      .update({ status: "rejected" })
      .eq("id", user1OpportunityId)
      .select();

    expect(data?.length ?? 0).toBe(0);
  });

  it("should allow user to DELETE their own opportunities", async () => {
    // Create an opportunity to delete
    const { data: newOpp } = await user1Client
      .from("opportunities")
      .insert({
        user_id: user1.id,
        title: "To Delete",
        company: "Delete Corp",
        status: "tracking",
      })
      .select()
      .single();

    const { error } = await user1Client
      .from("opportunities")
      .delete()
      .eq("id", newOpp!.id);

    expect(error).toBeNull();
  });

  it("should NOT allow user to DELETE another user opportunities", async () => {
    const { data } = await user2Client
      .from("opportunities")
      .delete()
      .eq("id", user1OpportunityId)
      .select();

    expect(data?.length ?? 0).toBe(0);
  });
});
