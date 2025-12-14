#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  // Get database URL from environment or use the one from .env
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://morse:d5szdJe3YGhR6qCuY9NSFowTS17p5vzc@dpg-d4udng8gjchc73c71nkg-a.oregon-postgres.render.com:5432/morse';

  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_fix_workouts_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running database migration...');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify the changes
    console.log('\nVerifying schema changes...');

    // Check workouts table
    const workoutsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'workouts'
      ORDER BY ordinal_position
    `);

    console.log('\nWorkouts table columns:');
    console.log(workoutsResult.rows.map(row => `  - ${row.column_name}: ${row.data_type}`).join('\n'));

    // Check sessions table for device_uuid
    const sessionsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'device_uuid'
    `);

    if (sessionsResult.rows.length > 0) {
      console.log('\n✅ sessions.device_uuid column exists');
    } else {
      console.log('\n❌ sessions.device_uuid column missing');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();