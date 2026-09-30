// Integration tests run against a dedicated `belliza_test` database (never
// the dev/demo database), seeded the same way via `npm run db:seed:test`.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/belliza_test";
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = "test-secret-not-for-production";
