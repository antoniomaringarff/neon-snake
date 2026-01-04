// Migration: Add is_immune flag to users table
export const up = async (pool) => {
  await pool.query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS is_immune BOOLEAN DEFAULT FALSE;
  `);
  console.log('✅ Migration 022: Added is_immune column to users table');
};

export const down = async (pool) => {
  await pool.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS is_immune;
  `);
  console.log('✅ Migration 022 rolled back: Removed is_immune column');
};

