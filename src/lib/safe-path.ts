import path from "node:path";

export function assertSafeStorageKey(key: string) {
  if (!key || key.length > 200 || key.includes("..") || key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
    throw new Error("unsafe key");
  }
  if (!/^[A-Za-z0-9/_.-]+$/.test(key)) throw new Error("unsafe key");
}

export function resolveInside(root: string, key: string) {
  assertSafeStorageKey(key);
  const base = path.resolve(root);
  const target = path.resolve(base, key);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("unsafe key");
  return target;
}
