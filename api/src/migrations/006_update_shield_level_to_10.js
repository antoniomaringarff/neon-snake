export const up = async (pool) => {
  await pool.query(`
    -- Update shield_level constraint to allow up to level 10
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_shield_level_check;
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_shield_level_check CHECK (shield_level >= 0 AND shield_level <= 10);
  `);

  console.log('✅ Migration 006_update_shield_level_to_10 completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Revert shield_level constraint back to level 5
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_shield_level_check;
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_shield_level_check CHECK (shield_level >= 0 AND shield_level <= 5);
  `);

  console.log('✅ Migration 006_update_shield_level_to_10 rolled back');
};

