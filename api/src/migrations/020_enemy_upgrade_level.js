export const up = async (pool) => {
  await pool.query(`
    -- Agregar campo enemy_upgrade_level a game_levels
    -- Este valor (0-10) define el nivel medio de mejoras de tienda de los enemigos
    -- La distribución piramidal genera valores alrededor de este nivel medio
    ALTER TABLE game_levels
    ADD COLUMN IF NOT EXISTS enemy_upgrade_level INTEGER DEFAULT 0;
    
    -- Actualizar los niveles existentes con valores calculados (como estaba antes)
    -- Fórmula original: Math.floor((level - 1) * 10 / 24)
    UPDATE game_levels SET enemy_upgrade_level = FLOOR((level_number - 1) * 10.0 / 24);
    
    -- Constraint para asegurar valores válidos
    ALTER TABLE game_levels
    ADD CONSTRAINT check_enemy_upgrade_level CHECK (enemy_upgrade_level >= 0 AND enemy_upgrade_level <= 10);
    
    COMMENT ON COLUMN game_levels.enemy_upgrade_level IS 'Nivel medio de mejoras de tienda de enemigos (0-10). Los enemigos tendrán valores aleatorios con distribución piramidal centrada en este valor ±4.';
  `);
  
  console.log('✅ Migration 020_enemy_upgrade_level completed');
};

export const down = async (pool) => {
  await pool.query(`
    ALTER TABLE game_levels
    DROP CONSTRAINT IF EXISTS check_enemy_upgrade_level,
    DROP COLUMN IF EXISTS enemy_upgrade_level;
  `);
  
  console.log('✅ Migration 020_enemy_upgrade_level rolled back');
};
