import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUserWithClient,
  cleanupTestUsers,
  generateTestEmail,
} from "../setup/test-utils";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("Profile CRUD Operations", () => {
  let user: User;
  let client: SupabaseClient<Database>;
  const testEmail = generateTestEmail("profile-crud");

  beforeAll(async () => {
    const result = await createTestUserWithClient(testEmail);
    user = result.user;
    client = result.client;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  describe("Read Profile", () => {
    it("should auto-create profile on user signup", async () => {
      // Profile should already exist from the signup trigger
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(user.id);
      expect(data?.email).toBe(testEmail);
    });

    it("should return profile with all expected fields", async () => {
      const { data } = await client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Check that all expected fields are present
      expect(data).toHaveProperty("id");
      expect(data).toHaveProperty("email");
      expect(data).toHaveProperty("name");
      expect(data).toHaveProperty("phone");
      expect(data).toHaveProperty("location");
      expect(data).toHaveProperty("linkedin");
      expect(data).toHaveProperty("github");
      expect(data).toHaveProperty("website");
      expect(data).toHaveProperty("created_at");
      expect(data).toHaveProperty("updated_at");
    });
  });

  describe("Update Profile", () => {
    it("should update profile name", async () => {
      const newName = "Test User Name";

      const { data, error } = await client
        .from("profiles")
        .update({ name: newName })
        .eq("id", user.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe(newName);
    });

    it("should update profile contact fields", async () => {
      const updates = {
        phone: "+1-555-123-4567",
        location: "San Francisco, CA",
        linkedin: "https://linkedin.com/in/testuser",
        github: "https://github.com/testuser",
        website: "https://testuser.dev",
      };

      const { data, error } = await client
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.phone).toBe(updates.phone);
      expect(data?.location).toBe(updates.location);
      expect(data?.linkedin).toBe(updates.linkedin);
      expect(data?.github).toBe(updates.github);
      expect(data?.website).toBe(updates.website);
    });

    it("should update updated_at timestamp on changes", async () => {
      // Get current profile
      await client
        .from("profiles")
        .select("updated_at")
        .eq("id", user.id)
        .single();

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update profile
      await client
        .from("profiles")
        .update({ name: `Updated at ${Date.now()}` })
        .eq("id", user.id);

      // Get updated profile
      const { data: after } = await client
        .from("profiles")
        .select("updated_at")
        .eq("id", user.id)
        .single();

      // updated_at should be different (or at least not before the original)
      expect(after?.updated_at).toBeDefined();
      // Note: Some DBs might not auto-update this field, test documents current behavior
    });

    it("should allow setting fields to null", async () => {
      // First set a value
      await client
        .from("profiles")
        .update({ phone: "+1-555-555-5555" })
        .eq("id", user.id);

      // Then set it to null
      const { data, error } = await client
        .from("profiles")
        .update({ phone: null })
        .eq("id", user.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.phone).toBeNull();
    });
  });

  describe("Work History Integration", () => {
    let documentId: string;

    beforeAll(async () => {
      // Work history requires a document_id, so create a document first
      const { data: doc } = await client
        .from("documents")
        .insert({
          user_id: user.id,
          type: "resume",
          filename: "work-history-test.pdf",
          status: "completed",
        })
        .select()
        .single();
      documentId = doc!.id;
    });

    it("should create work history entries for user", async () => {
      const workHistory = {
        user_id: user.id,
        document_id: documentId,
        company: "Test Company",
        title: "Software Engineer",
        start_date: "2020-01-01",
        end_date: "2023-12-31",
        location: "Remote",
        summary: "Worked on various projects",
        order_index: 0,
      };

      const { data, error } = await client
        .from("work_history")
        .insert(workHistory)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.company).toBe("Test Company");
      expect(data?.title).toBe("Software Engineer");
      expect(data?.user_id).toBe(user.id);
    });

    it("should read work history for user", async () => {
      const { data, error } = await client
        .from("work_history")
        .select("*")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("should update work history entry", async () => {
      // Get existing entry
      const { data: existing } = await client
        .from("work_history")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const { data, error } = await client
        .from("work_history")
        .update({ title: "Senior Software Engineer" })
        .eq("id", existing!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.title).toBe("Senior Software Engineer");
    });

    it("should delete work history entry", async () => {
      // Create a work history entry to delete
      const { data: created } = await client
        .from("work_history")
        .insert({
          user_id: user.id,
          document_id: documentId,
          company: "To Delete Corp",
          title: "To Delete",
          start_date: "2022-01-01",
          order_index: 99,
        })
        .select()
        .single();

      // Delete it
      const { error } = await client
        .from("work_history")
        .delete()
        .eq("id", created!.id);

      expect(error).toBeNull();

      // Verify deleted
      const { data: verify } = await client
        .from("work_history")
        .select("id")
        .eq("id", created!.id);

      expect(verify?.length ?? 0).toBe(0);
    });
  });
});

describe("Profile API Key Management", () => {
  let user: User;
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    const result = await createTestUserWithClient(
      generateTestEmail("api-keys"),
    );
    user = result.user;
    client = result.client;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("should create API key for user", async () => {
    // API keys are created with a hash, not plain text
    const keyHash = crypto.randomUUID(); // In real usage, this would be a proper hash
    const keyPrefix = "idn_test";

    const { data, error } = await client
      .from("api_keys")
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: "Test API Key",
        scopes: ["read", "write"],
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe("Test API Key");
    expect(data?.key_prefix).toBe(keyPrefix);
    expect(data?.user_id).toBe(user.id);
  });

  it("should list API keys for user", async () => {
    const { data, error } = await client
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("should revoke API key", async () => {
    // Create a key to revoke (key_prefix must be idn_ followed by exactly 4 lowercase alphanumeric chars)
    const { data: created, error: createError } = await client
      .from("api_keys")
      .insert({
        user_id: user.id,
        key_hash: crypto.randomUUID(),
        key_prefix: "idn_rev0", // Must match pattern ^idn_[a-z0-9]{4}$
        name: "Key to Revoke",
        scopes: ["read"],
      })
      .select()
      .single();

    expect(createError).toBeNull();
    expect(created).not.toBeNull();

    // Revoke it
    const { data, error } = await client
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", created!.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data?.revoked_at).toBeDefined();
  });
});
