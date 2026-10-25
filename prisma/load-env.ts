import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
for (const line of readFileSync(file, "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match?.[1] && process.env[match[1]] === undefined) process.env[match[1]] = match[2] ?? "";
}
