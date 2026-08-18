import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query, closePool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  console.log('Applying schema...');
  await query(sql);
  console.log('Schema applied.');
}

main()
  .catch((err) => {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(closePool);
