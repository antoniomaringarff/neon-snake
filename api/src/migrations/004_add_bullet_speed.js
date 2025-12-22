export const up = async (pool) => {
  await pool.query(`
    -- Add bullet_speed_level column to user_progress
    ALTER TABLE user_progress
    ADD COLUMN IF NOT EXISTS bullet_speed_level INTEGER DEFAULT 0 CHECK (bullet_speed_level >= 0 AND bullet_speed_level <= 10);
    
    -- Insert bullet speed upgrades (all levels same price as cannon level 5: 1000 XP, 10 stars)
    INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description) VALUES
      ('bullet_speed', 1, 1000, 10, 'Velocidad de bala x 2'),
      ('bullet_speed', 2, 1000, 10, 'Velocidad de bala x 4'),
      ('bullet_speed', 3, 1000, 10, 'Velocidad de bala x 8'),
      ('bullet_speed', 4, 1000, 10, 'Velocidad de bala x 16'),
      ('bullet_speed', 5, 1000, 10, 'Velocidad de bala x 32'),
      ('bullet_speed', 6, 1000, 10, 'Velocidad de bala x 64'),
      ('bullet_speed', 7, 1000, 10, 'Velocidad de bala x 128'),
      ('bullet_speed', 8, 1000, 10, 'Velocidad de bala x 256'),
      ('bullet_speed', 9, 1000, 10, 'Velocidad de bala x 512'),
      ('bullet_speed', 10, 1000, 10, 'Velocidad de bala x 1024')
    ON CONFLICT (upgrade_type, level) DO NOTHING;
  `);

  console.log('✅ Migration 004_add_bullet_speed completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Remove bullet speed upgrades
    DELETE FROM shop_upgrades WHERE upgrade_type = 'bullet_speed';
    
    -- Remove bullet_speed_level column
    ALTER TABLE user_progress
    DROP COLUMN IF EXISTS bullet_speed_level;
  `);

  console.log('✅ Migration 004_add_bullet_speed rolled back');
};

