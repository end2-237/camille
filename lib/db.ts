import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export default pool;
