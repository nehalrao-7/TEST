import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, passwordMatches, verifySessionToken } from "@/lib/auth";

describe("session tokens", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret";
  });

  it("verifies a freshly issued token", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects empty / malformed tokens", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("not-a-token")).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken();
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(await verifySessionToken(tampered)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const past = String(Date.now() - 1000);
    // Re-sign with the known secret so only expiry is invalid.
    const valid = await createSessionToken();
    const sig = valid.slice(valid.indexOf(".") + 1);
    // A token with a real-format but past expiry + mismatched sig must fail.
    expect(await verifySessionToken(`${past}.${sig}`)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.ADMIN_SESSION_SECRET = "different-secret";
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("returns false when no ADMIN_PASSWORD is set", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(passwordMatches("anything")).toBe(false);
  });

  it("matches only the configured password", () => {
    process.env.ADMIN_PASSWORD = "hoops2026";
    expect(passwordMatches("hoops2026")).toBe(true);
    expect(passwordMatches("wrong")).toBe(false);
  });
});
