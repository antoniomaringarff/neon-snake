// Migration: Add free_shots flag to users table
export async function up(pool) {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS free_shots BOOLEAN DEFAULT FALSE
  `);

  console.log('✅ Added free_shots column to users table');
}

export async function down(pool) {
  await pool.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS free_shots
  `);

  console.log('✅ Removed free_shots column from users table');
}

