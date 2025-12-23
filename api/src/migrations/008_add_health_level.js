// Migration: Add health_level to user_progress and health upgrades to shop
export async function up(pool) {
  // Add health_level column to user_progress
  await pool.query(`
    ALTER TABLE user_progress 
    ADD COLUMN IF NOT EXISTS health_level INTEGER DEFAULT 0 CHECK (health_level >= 0 AND health_level <= 10)
  `);

  // Insert health upgrades into shop_upgrades
  // Level 0 = 2 health, Level 1 = 4, Level 2 = 6... Level 10 = 22
  // Costo: 150 XP y 5 estrellas por nivel
  const healthUpgrades = [
    { level: 1, xp: 150, stars: 5, desc: '4 puntos de vida máximos' },
    { level: 2, xp: 150, stars: 5, desc: '6 puntos de vida máximos' },
    { level: 3, xp: 150, stars: 5, desc: '8 puntos de vida máximos' },
    { level: 4, xp: 150, stars: 5, desc: '10 puntos de vida máximos' },
    { level: 5, xp: 150, stars: 5, desc: '12 puntos de vida máximos' },
    { level: 6, xp: 150, stars: 5, desc: '14 puntos de vida máximos' },
    { level: 7, xp: 150, stars: 5, desc: '16 puntos de vida máximos' },
    { level: 8, xp: 150, stars: 5, desc: '18 puntos de vida máximos' },
    { level: 9, xp: 150, stars: 5, desc: '20 puntos de vida máximos' },
    { level: 10, xp: 150, stars: 5, desc: '22 puntos de vida máximos' }
  ];

  for (const upgrade of healthUpgrades) {
    await pool.query(`
      INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description)
      VALUES ('health', $1, $2, $3, $4)
      ON CONFLICT (upgrade_type, level) DO UPDATE SET
        xp_cost = $2,
        stars_cost = $3,
        description = $4
    `, [upgrade.level, upgrade.xp, upgrade.stars, upgrade.desc]);
  }

  console.log('✅ Added health_level column and health shop upgrades');
}

export async function down(pool) {
  await pool.query(`
    ALTER TABLE user_progress DROP COLUMN IF EXISTS health_level
  `);
  
  await pool.query(`
    DELETE FROM shop_upgrades WHERE upgrade_type = 'health'
  `);

  console.log('✅ Removed health_level column and health shop upgrades');
}

