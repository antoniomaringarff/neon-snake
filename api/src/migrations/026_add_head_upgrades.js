// Migration: Add head upgrades to shop_upgrades
// Head level already exists in user_progress, we just need to add shop values
export async function up(pool) {
  // Insert head upgrades into shop_upgrades
  // Level 1: Base (1.0x), Level 2: +10% (1.1x), Level 3: +20% (1.2x)
  const headUpgrades = [
    { level: 1, xp: 0, stars: 0, desc: 'XP base (1.0x)' },
    { level: 2, xp: 500, stars: 15, desc: 'XP +10% (1.1x)' },
    { level: 3, xp: 1000, stars: 25, desc: 'XP +20% (1.2x)' }
  ];

  for (const upgrade of headUpgrades) {
    await pool.query(`
      INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description)
      VALUES ('head', $1, $2, $3, $4)
      ON CONFLICT (upgrade_type, level) DO UPDATE SET
        xp_cost = $2,
        stars_cost = $3,
        description = $4
    `, [upgrade.level, upgrade.xp, upgrade.stars, upgrade.desc]);
  }

  console.log('✅ Added head upgrades to shop_upgrades');
}

export async function down(pool) {
  await pool.query(`
    DELETE FROM shop_upgrades WHERE upgrade_type = 'head'
  `);

  console.log('✅ Removed head upgrades from shop_upgrades');
}
