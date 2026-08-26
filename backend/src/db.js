const { Pool } = require('pg');
require('dotenv').config();

// Reads PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD from .env automatically
const pool = new Pool();

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
