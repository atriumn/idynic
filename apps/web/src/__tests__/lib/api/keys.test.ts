import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
} from "@/lib/api/keys";

describe("api/keys", () => {
  describe("generateApiKey", () => {
    it("returns key with idn_ prefix", () => {
      const { key } = generateApiKey();
      expect(key).toMatch(/^idn_/);
    });

    it("returns hash of the key", () => {
      const { key, hash } = generateApiKey();
      expect(hash).toBe(hashApiKey(key));
    });

    it("returns prefix for display", () => {
      const { key, prefix } = generateApiKey();
      expect(key.startsWith(prefix)).toBe(true);
      expect(prefix).toMatch(/^idn_[a-f0-9]{4}$/);
    });

    it("generates unique keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { key } = generateApiKey();
        keys.add(key);
      }
      expect(keys.size).toBe(100);
    });

    it("generates keys with correct format", () => {
      const { key } = generateApiKey();
      expect(isValidApiKeyFormat(key)).toBe(true);
    });
  });

  describe("hashApiKey", () => {
    it("produces consistent hash for same input", () => {
      const key = "idn_test123456789abcdef";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = hashApiKey("idn_key1");
      const hash2 = hashApiKey("idn_key2");
      expect(hash1).not.toBe(hash2);
    });

    it("produces SHA256 hash (64 hex chars)", () => {
      const hash = hashApiKey("idn_test");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("is case-sensitive", () => {
      const hash1 = hashApiKey("idn_Test");
      const hash2 = hashApiKey("idn_test");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isValidApiKeyFormat", () => {
    it("accepts valid key format (idn_ + 64 hex)", () => {
      const { key } = generateApiKey();
      expect(isValidApiKeyFormat(key)).toBe(true);
    });

    it("accepts manually constructed valid key", () => {
      const validKey = "idn_" + "a".repeat(64);
      expect(isValidApiKeyFormat(validKey)).toBe(true);
    });

    it("rejects keys without prefix", () => {
      const noPrefix = "a".repeat(64);
      expect(isValidApiKeyFormat(noPrefix)).toBe(false);
    });

    it("rejects keys with wrong prefix", () => {
      const wrongPrefix = "key_" + "a".repeat(64);
      expect(isValidApiKeyFormat(wrongPrefix)).toBe(false);
    });

    it("rejects empty keys", () => {
      expect(isValidApiKeyFormat("")).toBe(false);
    });

    it("rejects keys that are too short", () => {
      expect(isValidApiKeyFormat("idn_")).toBe(false);
      expect(isValidApiKeyFormat("idn_abc")).toBe(false);
      expect(isValidApiKeyFormat("idn_" + "a".repeat(63))).toBe(false);
    });

    it("rejects keys that are too long", () => {
      expect(isValidApiKeyFormat("idn_" + "a".repeat(65))).toBe(false);
    });

    it("rejects keys with invalid characters", () => {
      expect(isValidApiKeyFormat("idn_" + "g".repeat(64))).toBe(false); // g is not hex
      expect(isValidApiKeyFormat("idn_" + "A".repeat(64))).toBe(false); // uppercase
    });
  });
});
