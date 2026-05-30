import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./validators.js";

describe("auth validation", () => {
  it("accepts a normalized registration payload", () => {
    const parsed = registerSchema.parse({
      email: "Asha@example.com",
      password: "securepass1"
    });

    expect(parsed.email).toBe("asha@example.com");
  });

  it("rejects weak passwords", () => {
    expect(() =>
      loginSchema.parse({
        email: "holder@example.com",
        password: "short"
      })
    ).toThrow();
  });
});
