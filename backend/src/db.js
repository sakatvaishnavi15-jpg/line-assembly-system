const { Pool } = require('pg');
require('dotenv').config();

// On Render (and most managed cloud Postgres), you'll set a single
// DATABASE_URL environment variable, and the connection requires SSL.
// Locally, we keep using the individual PGHOST/PGPORT/etc. vars with no SSL.
const isProduction = !!process.env.DATABASE_URL;

const pool = isProduction
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool(); // reads PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD from .env

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;