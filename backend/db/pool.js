import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set. Add it to backend/.env');
    }
    // `pg` currently treats sslmode=require as full verification, but plans to
    // relax it to libpq semantics in v9. Pinning verify-full keeps certificate
    // checking on across that change. Neon presents a publicly-trusted cert, so
    // no rejectUnauthorized override is needed.
    pool = new Pool({
      connectionString: url.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full'),
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
