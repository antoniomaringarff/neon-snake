export const up = async (pool) => {
  await pool.query(`
    -- Add new columns to game_levels table
    ALTER TABLE game_levels
    ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS map_size INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS structures_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS killer_saw_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS floating_cannon_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resentful_snake_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS health_box_count INTEGER DEFAULT 0;

    -- Update existing levels with default values for new fields
    UPDATE game_levels
    SET xp_points = COALESCE(xp_points, xp_density),
        map_size = COALESCE(map_size, 10),
        structures_count = COALESCE(structures_count, 0),
        killer_saw_count = COALESCE(killer_saw_count, 0),
        floating_cannon_count = COALESCE(floating_cannon_count, 0),
        resentful_snake_count = COALESCE(resentful_snake_count, 0),
        health_box_count = COALESCE(health_box_count, 0);

    -- Delete existing levels to replace with new 25-level system
    DELETE FROM game_levels;

    -- Insert all 25 levels with the new configuration
    INSERT INTO game_levels (
      level_number, stars_needed, player_speed, enemy_speed, enemy_count,
      enemy_density, enemy_shoot_percentage, enemy_shield_percentage,
      enemy_shoot_cooldown, xp_density, xp_points, map_size, structures_count,
      killer_saw_count, floating_cannon_count, resentful_snake_count, health_box_count,
      background_type, structure_id, has_central_cell, central_cell_opening_speed
    ) VALUES
      (1, 1, 2.0, 2.0, 5, 15, 0, 0, 5000, 100, 5000, 10, 0, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (2, 2, 2.0, 2.0, 10, 15, 0, 0, 5000, 100, 5500, 11, 0, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (3, 3, 2.0, 2.0, 15, 15, 0, 0, 5000, 100, 6050, 12, 1, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (4, 4, 2.0, 2.0, 20, 15, 0, 0, 5000, 100, 6655, 13, 2, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (5, 5, 2.0, 2.0, 25, 15, 0, 0, 5000, 100, 7321, 14, 3, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (6, 6, 2.0, 2.0, 30, 15, 0, 0, 5000, 100, 8053, 15, 4, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (7, 7, 2.0, 2.0, 35, 15, 0, 0, 5000, 100, 8858, 16, 4, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (8, 8, 2.0, 2.0, 40, 15, 0, 0, 5000, 100, 9744, 17, 3, 0, 0, 0, 0, 'default', NULL, false, 0.002),
      (9, 9, 2.0, 2.0, 45, 15, 0, 0, 5000, 100, 10718, 18, 2, 2, 0, 0, 0, 'default', NULL, false, 0.002),
      (10, 10, 2.0, 2.0, 50, 15, 0, 0, 5000, 100, 11790, 19, 4, 2, 0, 0, 0, 'default', NULL, false, 0.002),
      (11, 11, 2.0, 2.0, 55, 15, 0, 0, 5000, 100, 12969, 20, 5, 2, 0, 0, 0, 'default', NULL, false, 0.002),
      (12, 12, 2.0, 2.0, 60, 15, 0, 0, 5000, 100, 14266, 21, 6, 4, 0, 0, 0, 'default', NULL, false, 0.002),
      (13, 13, 2.0, 2.0, 65, 15, 0, 0, 5000, 100, 15692, 22, 7, 4, 0, 0, 0, 'default', NULL, false, 0.002),
      (14, 14, 2.0, 2.0, 70, 15, 0, 0, 5000, 100, 17261, 23, 7, 4, 0, 0, 0, 'default', NULL, false, 0.002),
      (15, 15, 2.0, 2.0, 75, 15, 0, 0, 5000, 100, 18987, 24, 0, 6, 0, 0, 0, 'default', NULL, false, 0.002),
      (16, 16, 2.0, 2.0, 80, 15, 0, 0, 5000, 100, 20886, 25, 0, 6, 2, 0, 0, 'default', NULL, false, 0.002),
      (17, 17, 2.0, 2.0, 85, 15, 0, 0, 5000, 100, 22975, 26, 0, 6, 2, 0, 0, 'default', NULL, false, 0.002),
      (18, 18, 2.0, 2.0, 90, 15, 0, 0, 5000, 100, 25272, 27, 4, 8, 4, 0, 0, 'default', NULL, false, 0.002),
      (19, 19, 2.0, 2.0, 95, 15, 0, 0, 5000, 100, 27800, 28, 5, 8, 4, 0, 0, 'default', NULL, false, 0.002),
      (20, 20, 2.0, 2.0, 100, 15, 0, 0, 5000, 100, 30580, 29, 6, 8, 6, 2, 0, 'default', NULL, false, 0.002),
      (21, 21, 2.0, 2.0, 105, 15, 0, 0, 5000, 100, 33638, 30, 7, 10, 6, 2, 0, 'default', NULL, false, 0.002),
      (22, 22, 2.0, 2.0, 110, 15, 0, 0, 5000, 100, 37002, 31, 7, 10, 8, 4, 0, 'default', NULL, false, 0.002),
      (23, 23, 2.0, 2.0, 115, 15, 0, 0, 5000, 100, 40702, 32, 7, 10, 8, 4, 0, 'default', NULL, false, 0.002),
      (24, 24, 2.0, 2.0, 120, 15, 0, 0, 5000, 100, 44772, 33, 7, 10, 10, 6, 0, 'default', NULL, false, 0.002),
      (25, 25, 2.0, 2.0, 125, 15, 0, 0, 5000, 100, 49249, 34, 10, 15, 10, 6, 0, 'default', NULL, false, 0.002);
  `);

  console.log('✅ Migration 014_level_system_v2 completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Remove new columns from game_levels table
    ALTER TABLE game_levels
    DROP COLUMN IF EXISTS xp_points,
    DROP COLUMN IF EXISTS map_size,
    DROP COLUMN IF EXISTS structures_count,
    DROP COLUMN IF EXISTS killer_saw_count,
    DROP COLUMN IF EXISTS floating_cannon_count,
    DROP COLUMN IF EXISTS resentful_snake_count,
    DROP COLUMN IF EXISTS health_box_count;
  `);

  console.log('✅ Migration 014_level_system_v2 rolled back');
};

