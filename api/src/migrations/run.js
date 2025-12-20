import { pool } from '../config/database.js';
import * as migration001 from './001_initial_schema.js';

const migrations = [
  { name: '001_initial_schema', up: migration001.up, down: migration001.down }
];

async function runMigrations() {
  try {
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get already executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedNames = executedMigrations.map(m => m.name);

    // Run pending migrations
    for (const migration of migrations) {
      if (!executedNames.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        await migration.up(pool);
        await pool.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migration.name]
        );
        console.log(`✅ Migration ${migration.name} completed`);
      } else {
        console.log(`⏭️  Migration ${migration.name} already executed`);
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
