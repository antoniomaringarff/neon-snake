// Migration: Fix magnet_level constraint to allow 0-10
export async function up(pool) {
  // Update the constraint on user_progress to allow magnet_level up to 10
  await pool.query(`
    ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_magnet_level_check
  `);
  await pool.query(`
    ALTER TABLE user_progress ADD CONSTRAINT user_progress_magnet_level_check 
    CHECK (magnet_level >= 0 AND magnet_level <= 10)
  `);

  console.log('✅ Updated magnet_level constraint to allow 0-10');
}

export async function down(pool) {
  // Revert constraint to 0-5
  await pool.query(`
    ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_magnet_level_check
  `);
  await pool.query(`
    ALTER TABLE user_progress ADD CONSTRAINT user_progress_magnet_level_check 
    CHECK (magnet_level >= 0 AND magnet_level <= 5)
  `);

  console.log('✅ Reverted magnet_level constraint to 0-5');
}

