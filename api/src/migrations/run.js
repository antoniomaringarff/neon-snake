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
import * as migration010 from './010_fix_magnet_constraint.js';
import * as migration011 from './011_fix_magnet_constraint_v2.js';
import * as migration012 from './012_update_magnet_descriptions.js';
import * as migration013 from './013_add_free_shots_flag.js';
import * as migration014 from './014_level_system_v2.js';
import * as migration015 from './015_update_record_level25.js';
import * as migration016 from './016_reset_all_progress.js';
import * as migration017 from './017_email_optional.js';
import * as migration018 from './018_rebirth_and_series.js';
import * as migration019 from './019_update_leaderboard_level25.js';
import * as migration020 from './020_enemy_upgrade_level.js';
import * as migration021 from './021_update_level_values.js';
import * as migration022 from './022_add_is_immune_flag.js';
import * as migration023 from './023_initial_upgrades.js';
import * as migration024 from './024_add_chat.js';
import * as migration025 from './025_add_banned_until.js';
import * as migration026 from './026_add_head_upgrades.js';
import * as migration027 from './027_update_level_xp_enemies.js';
import * as migration028 from './028_reset_progress_keep_skins.js';

const migrations = [
  { name: '001_initial_schema', up: migration001.up, down: migration001.down },
  { name: '002_shop_upgrades', up: migration002.up, down: migration002.down },
  { name: '003_add_magnet_speed', up: migration003.up, down: migration003.down },
  { name: '004_add_bullet_speed', up: migration004.up, down: migration004.down },
  { name: '005_admin_features', up: migration005.up, down: migration005.down },
  { name: '006_update_shield_level_to_10', up: migration006.up, down: migration006.down },
  { name: '007_add_is_admin_flag', up: migration007.up, down: migration007.down },
  { name: '008_add_health_level', up: migration008.up, down: migration008.down },
  { name: '009_expand_magnet_to_10', up: migration009.up, down: migration009.down },
  { name: '010_fix_magnet_constraint', up: migration010.up, down: migration010.down },
  { name: '011_fix_magnet_constraint_v2', up: migration011.up, down: migration011.down },
  { name: '012_update_magnet_descriptions', up: migration012.up, down: migration012.down },
  { name: '013_add_free_shots_flag', up: migration013.up, down: migration013.down },
  { name: '014_level_system_v2', up: migration014.up, down: migration014.down },
  { name: '015_update_record_level25', up: migration015.up, down: migration015.down },
  { name: '016_reset_all_progress', up: migration016.up, down: migration016.down },
  { name: '017_email_optional', up: migration017.up, down: migration017.down },
  { name: '018_rebirth_and_series', up: migration018.up, down: migration018.down },
  { name: '019_update_leaderboard_level25', up: migration019.up, down: migration019.down },
  { name: '020_enemy_upgrade_level', up: migration020.up, down: migration020.down },
  { name: '021_update_level_values', up: migration021.up, down: migration021.down },
  { name: '022_add_is_immune_flag', up: migration022.up, down: migration022.down },
  { name: '023_initial_upgrades', up: migration023.up, down: migration023.down },
  { name: '024_add_chat', up: migration024.up, down: migration024.down },
  { name: '025_add_banned_until', up: migration025.up, down: migration025.down },
  { name: '026_add_head_upgrades', up: migration026.up, down: migration026.down },
  { name: '027_update_level_xp_enemies', up: migration027.up, down: migration027.down },
  { name: '028_reset_progress_keep_skins', up: migration028.up, down: migration028.down }
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
