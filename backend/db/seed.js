import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, closePool } from './pool.js';

const DEMO_EMAIL = 'demo@wayfare.app';
const DEMO_PASSWORD = 'demo1234';

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Postgres equivalent of MySQL's ON DUPLICATE KEY UPDATE — re-running the
  // seed refreshes the demo user instead of erroring on the unique email.
  const result = await query(
    `INSERT INTO usercredentials (email, password, fullName)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
     RETURNING id`,
    [DEMO_EMAIL, hash, 'Demo Traveler'],
  );

  console.log(`Seeded demo user #${result.rows[0].id} (${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(closePool);
