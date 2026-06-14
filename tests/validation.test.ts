import { describe, expect, it } from "vitest";
import { leadSchema } from "@/lib/validation";

const base = { kidName: "Jordan", parentName: "Alex", parentPhone: "(905) 555-0123" };

describe("leadSchema", () => {
  it("accepts a minimal valid lead", () => {
    const r = leadSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("requires kid name, parent name, and phone", () => {
    expect(leadSchema.safeParse({}).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, parentPhone: "" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, kidName: "" }).success).toBe(false);
  });

  it("rejects a phone with letters", () => {
    expect(leadSchema.safeParse({ ...base, parentPhone: "call-me" }).success).toBe(false);
  });

  it("coerces a string birthYear to a number and validates range", () => {
    const ok = leadSchema.safeParse({ ...base, birthYear: "2015" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.birthYear).toBe(2015);

    expect(leadSchema.safeParse({ ...base, birthYear: "1900" }).success).toBe(false);
  });

  it("treats an empty birthYear as undefined", () => {
    const r = leadSchema.safeParse({ ...base, birthYear: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.birthYear).toBeUndefined();
  });

  it("accepts a filled honeypot (handled silently in the route, not rejected here)", () => {
    const r = leadSchema.safeParse({ ...base, website: "spam" });
    expect(r.success).toBe(true);
  });
});
