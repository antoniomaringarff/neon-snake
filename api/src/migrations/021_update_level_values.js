// Migration 021: Update all level values with new configuration
export async function up(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete existing levels and insert new ones with complete configuration
    await client.query('DELETE FROM game_levels');
    
    // Insert all 25 levels with the new values
    // Columns: level_number, xp_points, enemy_count, map_size, stars_needed, structures_count,
    //          killer_saw_count, floating_cannon_count, resentful_snake_count, health_box_count,
    //          player_speed, enemy_speed, enemy_density, enemy_shoot_percentage, enemy_shield_percentage, xp_density
    const levels = [
      [1,  200,  15,  10, 5,   0, 0,  0,  0,  1,  2, 2, 15, 0,  0,  200],
      [2,  220,  15,  11, 8,   0, 0,  0,  0,  2,  2, 2, 15, 0,  0,  220],
      [3,  242,  20,  12, 11,  1, 0,  0,  0,  3,  2, 2, 15, 10, 10, 242],
      [4,  266,  25,  13, 14,  2, 0,  0,  0,  4,  2, 2, 15, 10, 10, 266],
      [5,  293,  30,  14, 17,  3, 0,  0,  0,  5,  2, 2, 15, 20, 20, 293],
      [6,  322,  35,  15, 20,  4, 0,  0,  0,  6,  2, 2, 15, 20, 20, 322],
      [7,  354,  40,  16, 23,  4, 0,  0,  0,  7,  2, 2, 15, 30, 30, 354],
      [8,  390,  45,  17, 26,  3, 0,  0,  0,  8,  2, 2, 15, 30, 30, 390],
      [9,  429,  50,  18, 29,  2, 5,  2,  0,  9,  3, 2, 15, 40, 40, 429],
      [10, 472,  55,  19, 32,  4, 5,  2,  1,  10, 3, 2, 15, 40, 40, 472],
      [11, 519,  60,  20, 35,  5, 5,  4,  1,  11, 3, 2, 15, 50, 50, 519],
      [12, 571,  65,  21, 38,  6, 7,  4,  2,  12, 3, 2, 15, 50, 50, 571],
      [13, 628,  70,  22, 41,  7, 7,  6,  2,  13, 3, 3, 15, 50, 50, 628],
      [14, 690,  75,  23, 44,  7, 7,  6,  3,  14, 3, 3, 15, 60, 60, 690],
      [15, 759,  80,  24, 47,  0, 7,  8,  3,  15, 3, 3, 15, 60, 60, 759],
      [16, 835,  85,  25, 50,  0, 8,  8,  4,  16, 3, 3, 15, 60, 60, 835],
      [17, 919,  90,  26, 53,  0, 8,  8,  4,  17, 3, 3, 15, 70, 70, 919],
      [18, 1011, 95,  27, 56,  4, 8,  10, 4,  18, 4, 3, 15, 70, 70, 1011],
      [19, 1112, 100, 28, 59,  5, 8,  10, 4,  19, 4, 3, 15, 70, 70, 1112],
      [20, 1223, 105, 29, 62,  6, 8,  10, 5,  20, 4, 3, 15, 70, 70, 1223],
      [21, 1345, 110, 30, 65,  7, 10, 10, 5,  21, 4, 3, 15, 70, 70, 1345],
      [22, 1480, 115, 31, 68,  7, 10, 10, 5,  22, 4, 4, 15, 70, 70, 1480],
      [23, 1628, 120, 32, 71,  7, 10, 10, 6,  23, 4, 4, 15, 70, 70, 1628],
      [24, 1791, 125, 33, 74,  7, 10, 15, 6,  24, 4, 4, 15, 80, 80, 1791],
      [25, 1970, 130, 40, 100, 10, 15, 20, 10, 25, 5, 4, 15, 80, 80, 1970]
    ];
    
    for (const level of levels) {
      await client.query(`
        INSERT INTO game_levels (
          level_number, xp_points, enemy_count, map_size, stars_needed, structures_count,
          killer_saw_count, floating_cannon_count, resentful_snake_count, health_box_count,
          player_speed, enemy_speed, enemy_density, enemy_shoot_percentage, enemy_shield_percentage, xp_density,
          background_type, structure_id, has_central_cell, central_cell_opening_speed, enemy_shoot_cooldown
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          'default', NULL, false, 0.002, 3000
        )
      `, level);
    }
    
    // Also update enemy_upgrade_level based on level progression
    await client.query(`
      UPDATE game_levels
      SET enemy_upgrade_level = CASE
        WHEN level_number <= 5 THEN 0
        WHEN level_number <= 10 THEN 2
        WHEN level_number <= 15 THEN 4
        WHEN level_number <= 20 THEN 6
        WHEN level_number <= 24 THEN 8
        ELSE 10
      END
    `);
    
    await client.query('COMMIT');
    console.log('✅ Migration 021: Level values updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool) {
  // This migration replaces all level data, down would need to restore previous values
  // For safety, we'll just log a warning
  console.log('⚠️ Migration 021 down: Manual restoration of previous level values required');
}
