import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Add it to backend/.env');
    }
    pool = new Pool({
      connectionString: url,
      // Neon terminates connections without SSL. Locally (no sslmode in the URL)
      // we skip it so a plain postgres:// on localhost still works.
      ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }
  return pool;
}

/**
 * Returns the `pg` result object. Rows are on `.rows` — this is the one shape
 * difference from mysql2, which destructured `[rows]` off the front instead.
 */
export function query(sql, params) {
  return getPool().query(sql, params);
}

/**
 * Runs `fn` inside a transaction on a single dedicated connection. Saving a trip
 * writes to three tables, so a failure partway through must not leave a trip row
 * with no itinerary attached.
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
