import { pool } from '../config/database.js';
import * as migration001 from './001_initial_schema.js';
import * as migration002 from './002_shop_upgrades.js';
import * as migration003 from './003_add_magnet_speed.js';
import * as migration004 from './004_add_bullet_speed.js';
import * as migration005 from './005_admin_features.js';
import * as migration006 from './006_update_shield_level_to_10.js';
import * as migration007 from './007_add_is_admin_flag.js';
import * as migration008 from './008_add_health_level.js';
import * as migration009 from './009_expand_magnet_to_10.js';

const migrations = [
  { name: '001_initial_schema', up: migration001.up, down: migration001.down },
  { name: '002_shop_upgrades', up: migration002.up, down: migration002.down },
  { name: '003_add_magnet_speed', up: migration003.up, down: migration003.down },
  { name: '004_add_bullet_speed', up: migration004.up, down: migration004.down },
  { name: '005_admin_features', up: migration005.up, down: migration005.down },
  { name: '006_update_shield_level_to_10', up: migration006.up, down: migration006.down },
  { name: '007_add_is_admin_flag', up: migration007.up, down: migration007.down },
  { name: '008_add_health_level', up: migration008.up, down: migration008.down },
  { name: '009_expand_magnet_to_10', up: migration009.up, down: migration009.down }
];

export async function runMigrations() {
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
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Si se ejecuta directamente (npm run migrate), hacer exit
// Verificar si es el módulo principal
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('run.js') || 
  process.argv[1].includes('migrations/run.js')
);

if (isMainModule) {
  runMigrations()
    .then(() => {
      console.log('\n✅ Migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
