// Minimal migration runner: applies db/migrations/*.sql in filename order,
// tracking what's applied in a `_migrations` table. No external deps.
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Client } from "pg";
import "./env";

async function main() {
  const reset = process.argv.includes("--reset");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  if (reset) {
    console.log("Resetting schema `public`...");
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  }

  await client.query(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const dir = path.join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: appliedRows } = await client.query<{ filename: string }>(
    "select filename from public._migrations"
  );
  const applied = new Set(appliedRows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = readFileSync(path.join(dir, file), "utf8");
    console.log(`apply ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("insert into public._migrations (filename) values ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`Migration ${file} failed:`, err);
      await client.end();
      process.exit(1);
    }
  }

  console.log("Migrations up to date.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
