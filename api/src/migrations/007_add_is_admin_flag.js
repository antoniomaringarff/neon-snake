export const up = async (pool) => {
  await pool.query(`
    -- Add is_admin column to users table
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

    -- Create index for faster admin lookups
    CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
  `);

  console.log('✅ Migration 007_add_is_admin_flag completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP INDEX IF EXISTS idx_users_is_admin;
    ALTER TABLE users DROP COLUMN IF EXISTS is_admin;
  `);

  console.log('✅ Migration 007_add_is_admin_flag rolled back');
};

