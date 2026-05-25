import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Force search_path to camille on every new connection — more reliable than
// embedding it in the connection string URL which some pg versions ignore.
pool.on("connect", (client) => {
  client.query("SET search_path TO camille, public").catch(() => {});
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export default pool;
