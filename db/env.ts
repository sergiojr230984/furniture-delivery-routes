// Tiny .env loader for standalone scripts (db/migrate.ts, db/seed.ts) run via
// `tsx` outside of Next's own env loading. Next.js loads .env.local itself
// when running `next dev`/`next build`, so this is only needed here.
import { existsSync, readFileSync } from "fs";
import path from "path";

function load(file: string) {
  const full = path.join(process.cwd(), file);
  if (!existsSync(full)) return;
  const content = readFileSync(full, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

load(".env.local");
load(".env");
