// Migration 025: Add banned_until field for temporary bans

export const up = async (pool) => {
  await pool.query(`
    -- Add banned_until column to users table for temporary bans
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP NULL;
    
    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_users_banned_until ON users(banned_until) WHERE banned_until IS NOT NULL;
  `);
  
  console.log('✅ Migration 025_add_banned_until completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP INDEX IF EXISTS idx_users_banned_until;
    ALTER TABLE users DROP COLUMN IF EXISTS banned_until;
  `);
  
  console.log('✅ Migration 025_add_banned_until rolled back');
};
