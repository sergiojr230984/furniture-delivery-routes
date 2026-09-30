import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// node-postgres parses DATE/TIMESTAMP/TIMESTAMPTZ into JS Date objects by
// default, but every type in lib/types.ts models them as strings (so they
// serialize cleanly through Server Components/Actions and format
// predictably via lib/time.ts). Override those parsers once, globally.
types.setTypeParser(1082 /* date */, (val: string) => val);
types.setTypeParser(1114 /* timestamp */, (val: string) => new Date(val + "Z").toISOString());
types.setTypeParser(1184 /* timestamptz */, (val: string) => new Date(val).toISOString());

declare global {
  // eslint-disable-next-line no-var
  var __bellizaPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Postgres database."
    );
  }
  return new Pool({ connectionString, max: 10 });
}

// Reuse a single pool across hot reloads in dev.
const pool = global.__bellizaPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__bellizaPool = pool;

export type Row = QueryResultRow;

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends Row = Row>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Runs `fn` inside a single transaction. `fn` receives a client whose
// `query` method must be used for every statement in the transaction.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
