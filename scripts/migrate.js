/**
 * Database Migration Script
 * Initializes PostgreSQL schema for debt-recycler-au
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'debt_recycler',
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Starting database migration...');

    // Read SQL schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database migration completed successfully');
    console.log('Tables created:');
    console.log('  - scenarios (with indexes)');
    console.log('  - projections (with foreign key)');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
