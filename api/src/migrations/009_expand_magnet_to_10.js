// Migration: Expand magnet upgrades from 5 to 10 levels
export async function up(pool) {
  // Insert magnet upgrades levels 6-10 into shop_upgrades
  const magnetUpgrades = [
    { level: 6, stars: 10, desc: 'Atrae XP y estrellas a 300px de la cabeza' },
    { level: 7, stars: 10, desc: 'Atrae XP y estrellas a 350px de la cabeza' },
    { level: 8, stars: 10, desc: 'Atrae XP y estrellas a 400px de la cabeza' },
    { level: 9, stars: 15, desc: 'Atrae XP y estrellas a 450px de la cabeza' },
    { level: 10, stars: 15, desc: 'Atrae XP y estrellas a 500px de la cabeza' }
  ];

  for (const upgrade of magnetUpgrades) {
    await pool.query(`
      INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description)
      VALUES ('magnet', $1, 0, $2, $3)
      ON CONFLICT (upgrade_type, level) DO UPDATE SET
        stars_cost = $2,
        description = $3
    `, [upgrade.level, upgrade.stars, upgrade.desc]);
  }

  console.log('✅ Added magnet levels 6-10 to shop upgrades');
}

export async function down(pool) {
  await pool.query(`
    DELETE FROM shop_upgrades WHERE upgrade_type = 'magnet' AND level > 5
  `);

  console.log('✅ Removed magnet levels 6-10 from shop upgrades');
}

