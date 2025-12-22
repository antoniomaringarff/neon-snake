export const up = async (pool) => {
  await pool.query(`
    -- Add is_banned column to users table
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

    -- Create game_structures table
    CREATE TABLE IF NOT EXISTS game_structures (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      config JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Create game_levels table
    CREATE TABLE IF NOT EXISTS game_levels (
      id SERIAL PRIMARY KEY,
      level_number INTEGER UNIQUE NOT NULL,
      stars_needed INTEGER DEFAULT 1,
      player_speed DECIMAL(5,2) DEFAULT 2.0,
      enemy_speed DECIMAL(5,2) DEFAULT 2.0,
      enemy_count INTEGER DEFAULT 5,
      enemy_density INTEGER DEFAULT 15,
      enemy_shoot_percentage INTEGER DEFAULT 0 CHECK (enemy_shoot_percentage >= 0 AND enemy_shoot_percentage <= 100),
      enemy_shield_percentage INTEGER DEFAULT 0 CHECK (enemy_shield_percentage >= 0 AND enemy_shield_percentage <= 100),
      enemy_shoot_cooldown INTEGER DEFAULT 5000,
      xp_density INTEGER DEFAULT 100,
      background_type VARCHAR(50) DEFAULT 'default',
      structure_id INTEGER REFERENCES game_structures(id) ON DELETE SET NULL,
      has_central_cell BOOLEAN DEFAULT false,
      central_cell_opening_speed DECIMAL(10,6) DEFAULT 0.002,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for game_levels
    CREATE INDEX IF NOT EXISTS idx_game_levels_level_number ON game_levels(level_number);
    CREATE INDEX IF NOT EXISTS idx_game_levels_structure_id ON game_levels(structure_id);

    -- Insert default structure (cuadrado)
    INSERT INTO game_structures (name, description, config) VALUES
      ('cuadrado', 'Estructura cuadrada central con aberturas móviles', '{"type": "square", "width": 200, "height": 200}'::jsonb)
    ON CONFLICT (name) DO NOTHING;

    -- Insert initial level configurations (from getLevelConfig)
    INSERT INTO game_levels (
      level_number, stars_needed, player_speed, enemy_speed, enemy_count, 
      enemy_density, enemy_shoot_percentage, enemy_shield_percentage, 
      enemy_shoot_cooldown, xp_density, background_type, structure_id, 
      has_central_cell, central_cell_opening_speed
    ) VALUES
      (1, 1, 2.0, 2.0, 5, 15, 0, 0, 5000, 100, 'default', NULL, false, 0.002),
      (2, 2, 2.2, 2.3, 10, 18, 10, 0, 4500, 110, 'default', (SELECT id FROM game_structures WHERE name = 'cuadrado'), true, 0.0025),
      (3, 2, 2.4, 2.6, 13, 21, 20, 5, 4000, 120, 'default', (SELECT id FROM game_structures WHERE name = 'cuadrado'), true, 0.003),
      (4, 3, 2.6, 2.9, 16, 24, 30, 10, 3500, 130, 'default', (SELECT id FROM game_structures WHERE name = 'cuadrado'), true, 0.0035),
      (5, 3, 2.8, 3.2, 19, 27, 40, 15, 3000, 140, 'default', (SELECT id FROM game_structures WHERE name = 'cuadrado'), true, 0.004)
    ON CONFLICT (level_number) DO NOTHING;
  `);

  console.log('✅ Migration 005_admin_features completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP TABLE IF EXISTS game_levels CASCADE;
    DROP TABLE IF EXISTS game_structures CASCADE;
    ALTER TABLE users DROP COLUMN IF EXISTS is_banned;
  `);

  console.log('✅ Migration 005_admin_features rolled back');
};

