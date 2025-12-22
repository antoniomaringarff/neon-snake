export const up = async (pool) => {
  await pool.query(`
    -- Add magnet_level and speed_level columns to user_progress
    ALTER TABLE user_progress
    ADD COLUMN IF NOT EXISTS magnet_level INTEGER DEFAULT 0 CHECK (magnet_level >= 0 AND magnet_level <= 5),
    ADD COLUMN IF NOT EXISTS speed_level INTEGER DEFAULT 0 CHECK (speed_level >= 0 AND speed_level <= 10);
    
    -- Update shield_level constraint to allow up to level 5
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_shield_level_check;
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_shield_level_check CHECK (shield_level >= 0 AND shield_level <= 5);
    
    -- Update cannon_level constraint to allow up to level 5
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_cannon_level_check;
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_cannon_level_check CHECK (cannon_level >= 0 AND cannon_level <= 5);
    
    -- Add total_stars column to users table if it doesn't exist
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS total_stars INTEGER DEFAULT 0;
  `);

  console.log('✅ Migration 003_add_magnet_speed completed');
};

export const down = async (pool) => {
  await pool.query(`
    ALTER TABLE user_progress
    DROP COLUMN IF EXISTS magnet_level,
    DROP COLUMN IF EXISTS speed_level;
  `);

  console.log('✅ Migration 003_add_magnet_speed rolled back');
};

