// Migration: Remove CHECK constraints on upgrade levels to allow admin to set higher values
export const up = async (pool) => {
  await pool.query(`
    -- Remove all CHECK constraints on upgrade levels
    -- This allows admin to set values higher than the shop limits
    
    -- Drop speed_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_speed_level_check;
    
    -- Drop bullet_speed_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_bullet_speed_level_check;
    
    -- Drop health_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_health_level_check;
    
    -- Drop magnet_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_magnet_level_check;
    
    -- Drop shield_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_shield_level_check;
    
    -- Drop cannon_level constraint
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_cannon_level_check;
    
    -- Drop head_level constraint if exists
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_head_level_check;
    
    -- Add new constraints with higher limits (0-100) for admin flexibility
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_speed_level_check CHECK (speed_level >= 0 AND speed_level <= 100);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_bullet_speed_level_check CHECK (bullet_speed_level >= 0 AND bullet_speed_level <= 100);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_health_level_check CHECK (health_level >= 0 AND health_level <= 100);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_magnet_level_check CHECK (magnet_level >= 0 AND magnet_level <= 100);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_shield_level_check CHECK (shield_level >= 0 AND shield_level <= 100);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_cannon_level_check CHECK (cannon_level >= 0 AND cannon_level <= 100);
  `);

  console.log('✅ Migration 017: Removed upgrade level limits (now 0-100)');
};

export const down = async (pool) => {
  await pool.query(`
    -- Restore original limits
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_speed_level_check;
    
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_bullet_speed_level_check;
    
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_health_level_check;
    
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_magnet_level_check;
    
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_shield_level_check;
    
    ALTER TABLE user_progress
    DROP CONSTRAINT IF EXISTS user_progress_cannon_level_check;
    
    -- Restore original constraints
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_speed_level_check CHECK (speed_level >= 0 AND speed_level <= 10);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_bullet_speed_level_check CHECK (bullet_speed_level >= 0 AND bullet_speed_level <= 10);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_health_level_check CHECK (health_level >= 0 AND health_level <= 10);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_magnet_level_check CHECK (magnet_level >= 0 AND magnet_level <= 5);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_shield_level_check CHECK (shield_level >= 0 AND shield_level <= 5);
    
    ALTER TABLE user_progress
    ADD CONSTRAINT user_progress_cannon_level_check CHECK (cannon_level >= 0 AND cannon_level <= 5);
  `);

  console.log('✅ Migration 017 rolled back: Restored original upgrade level limits');
};

