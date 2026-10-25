import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInside } from "@/lib/safe-path";

describe("storage keys stay inside the private root", () => {
  const root = path.resolve("/tmp/mu-storage");

  it("resolves a normal key and rejects traversal", () => {
    expect(resolveInside(root, "submissions/abc")).toBe(path.join(root, "submissions/abc"));
    expect(() => resolveInside(root, "../etc/passwd")).toThrow(/unsafe/);
    expect(() => resolveInside(root, "submissions/../../etc/passwd")).toThrow(/unsafe/);
    expect(() => resolveInside(root, "/etc/passwd")).toThrow(/unsafe/);
    expect(() => resolveInside(root, "submissions/a b")).toThrow(/unsafe/);
  });
});
