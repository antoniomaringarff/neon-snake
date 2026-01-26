// Migration 025: Update XP points progression from 2000 to 4500
// Nivel 1: 2000, incrementando ~104 por nivel hasta llegar a 4500 en nivel 25

export const up = async (client) => {
  const baseXP = 2000;
  const maxXP = 4500;
  const totalLevels = 25;
  const incrementPerLevel = (maxXP - baseXP) / (totalLevels - 1); // ~104.17
  
  console.log('🎮 Actualizando XP points con progresión 2000 → 4500...');
  
  for (let level = 1; level <= totalLevels; level++) {
    // Calcular XP para este nivel (redondeado a entero)
    const xpPoints = Math.round(baseXP + (level - 1) * incrementPerLevel);
    
    await client.query(`
      UPDATE game_levels 
      SET xp_points = $1, xp_density = $1
      WHERE level_number = $2
    `, [xpPoints, level]);
    
    console.log(`  Nivel ${level}: ${xpPoints} XP`);
  }
  
  console.log('✅ XP points actualizados correctamente');
};

export const down = async (client) => {
  // Revertir a valores originales (exponenciales)
  const originalValues = [
    { level: 1, xp: 200 },
    { level: 2, xp: 220 },
    { level: 3, xp: 242 },
    { level: 4, xp: 266 },
    { level: 5, xp: 293 },
    { level: 6, xp: 322 },
    { level: 7, xp: 354 },
    { level: 8, xp: 390 },
    { level: 9, xp: 429 },
    { level: 10, xp: 472 },
    { level: 11, xp: 519 },
    { level: 12, xp: 571 },
    { level: 13, xp: 628 },
    { level: 14, xp: 690 },
    { level: 15, xp: 759 },
    { level: 16, xp: 835 },
    { level: 17, xp: 919 },
    { level: 18, xp: 1011 },
    { level: 19, xp: 1112 },
    { level: 20, xp: 1223 },
    { level: 21, xp: 1345 },
    { level: 22, xp: 1480 },
    { level: 23, xp: 1628 },
    { level: 24, xp: 1791 },
    { level: 25, xp: 5000 },
  ];
  
  for (const { level, xp } of originalValues) {
    await client.query(`
      UPDATE game_levels 
      SET xp_points = $1, xp_density = $1
      WHERE level_number = $2
    `, [xp, level]);
  }
  
  console.log('✅ Reverted XP points to original values');
};
