import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { ru } from "@/i18n/ru";
import { uz } from "@/i18n/uz";

function leaves(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

describe("message catalogs", () => {
  it("keeps uz, ru, and en keys aligned", () => {
    const english = leaves(en).sort();
    expect(leaves(ru).sort()).toEqual(english);
    expect(leaves(uz).sort()).toEqual(english);
  });
});
