// Migration: Update magnet descriptions for new range (25px per level)
export async function up(pool) {
  const magnetUpgrades = [
    { level: 1, desc: 'Atrae XP y estrellas a 25px de la cabeza' },
    { level: 2, desc: 'Atrae XP y estrellas a 50px de la cabeza' },
    { level: 3, desc: 'Atrae XP y estrellas a 75px de la cabeza' },
    { level: 4, desc: 'Atrae XP y estrellas a 100px de la cabeza' },
    { level: 5, desc: 'Atrae XP y estrellas a 125px de la cabeza' },
    { level: 6, desc: 'Atrae XP y estrellas a 150px de la cabeza' },
    { level: 7, desc: 'Atrae XP y estrellas a 175px de la cabeza' },
    { level: 8, desc: 'Atrae XP y estrellas a 200px de la cabeza' },
    { level: 9, desc: 'Atrae XP y estrellas a 225px de la cabeza' },
    { level: 10, desc: 'Atrae XP y estrellas a 250px de la cabeza' }
  ];

  for (const upgrade of magnetUpgrades) {
    await pool.query(`
      UPDATE shop_upgrades 
      SET description = $1
      WHERE upgrade_type = 'magnet' AND level = $2
    `, [upgrade.desc, upgrade.level]);
  }

  console.log('✅ Updated magnet descriptions to 25px per level');
}

export async function down(pool) {
  // Revert to old descriptions (50px per level)
  const magnetUpgrades = [
    { level: 1, desc: 'Atrae XP y estrellas a 50px de la cabeza' },
    { level: 2, desc: 'Atrae XP y estrellas a 100px de la cabeza' },
    { level: 3, desc: 'Atrae XP y estrellas a 150px de la cabeza' },
    { level: 4, desc: 'Atrae XP y estrellas a 200px de la cabeza' },
    { level: 5, desc: 'Atrae XP y estrellas a 250px de la cabeza' },
    { level: 6, desc: 'Atrae XP y estrellas a 300px de la cabeza' },
    { level: 7, desc: 'Atrae XP y estrellas a 350px de la cabeza' },
    { level: 8, desc: 'Atrae XP y estrellas a 400px de la cabeza' },
    { level: 9, desc: 'Atrae XP y estrellas a 450px de la cabeza' },
    { level: 10, desc: 'Atrae XP y estrellas a 500px de la cabeza' }
  ];

  for (const upgrade of magnetUpgrades) {
    await pool.query(`
      UPDATE shop_upgrades 
      SET description = $1
      WHERE upgrade_type = 'magnet' AND level = $2
    `, [upgrade.desc, upgrade.level]);
  }

  console.log('✅ Reverted magnet descriptions to 50px per level');
}

