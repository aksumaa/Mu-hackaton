import { describe, expect, it } from "vitest";
import { signLocalFile, verifyLocalSignature } from "@/lib/storage";

process.env.AUTH_SECRET ??= "test-secret-value";

describe("file links expire and do not transfer to another id", () => {
  it("accepts a fresh signature and rejects tampering or expiry", () => {
    const url = new URL(signLocalFile("file1", 60), "http://local");
    const exp = url.searchParams.get("exp") ?? "";
    const sig = url.searchParams.get("sig") ?? "";
    expect(verifyLocalSignature("file1", exp, sig)).toBe(true);
    expect(verifyLocalSignature("file2", exp, sig)).toBe(false);
    expect(verifyLocalSignature("file1", "10", sig)).toBe(false);
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyLocalSignature("file1", exp, flipped)).toBe(false);
  });
});
