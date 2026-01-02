export const up = async (pool) => {
  await pool.query(`
    -- Agregar rebirth_count a users
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS rebirth_count INTEGER DEFAULT 0;
    
    -- Agregar current_series a users (qué serie está jugando actualmente)
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS current_series INTEGER DEFAULT 1;
    
    -- Agregar series_number a game_sessions (en qué serie fue esta partida)
    ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS series_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS kills_count INTEGER DEFAULT 0;
    
    -- Agregar level_25_score a leaderboard para el ranking principal
    ALTER TABLE leaderboard
    ADD COLUMN IF NOT EXISTS level_25_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS level_25_kills INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS level_25_series INTEGER DEFAULT 0;
    
    -- Índices para mejorar performance
    CREATE INDEX IF NOT EXISTS idx_game_sessions_series ON game_sessions(series_number);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_level_25 ON leaderboard(level_25_score DESC);
    
    -- Comentarios explicativos
    COMMENT ON COLUMN users.rebirth_count IS 'Cantidad de veces que el usuario hizo rebirth (reinició desde nivel 1)';
    COMMENT ON COLUMN users.current_series IS 'Número de serie actual que está jugando (1-based)';
    COMMENT ON COLUMN game_sessions.series_number IS 'En qué serie fue jugada esta partida';
    COMMENT ON COLUMN game_sessions.kills_count IS 'Cantidad de víboras matadas en esta sesión';
    COMMENT ON COLUMN leaderboard.level_25_score IS 'Mejor puntuación al completar nivel 25';
    COMMENT ON COLUMN leaderboard.level_25_kills IS 'Kills totales en la mejor run de nivel 25';
    COMMENT ON COLUMN leaderboard.level_25_series IS 'En qué serie logró el mejor score de nivel 25';
  `);
  
  console.log('✅ Migration 018_rebirth_and_series completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Eliminar índices
    DROP INDEX IF EXISTS idx_game_sessions_series;
    DROP INDEX IF EXISTS idx_leaderboard_level_25;
    
    -- Eliminar columnas
    ALTER TABLE users
    DROP COLUMN IF EXISTS rebirth_count,
    DROP COLUMN IF EXISTS current_series;
    
    ALTER TABLE game_sessions
    DROP COLUMN IF EXISTS series_number,
    DROP COLUMN IF EXISTS kills_count;
    
    ALTER TABLE leaderboard
    DROP COLUMN IF EXISTS level_25_score,
    DROP COLUMN IF EXISTS level_25_kills,
    DROP COLUMN IF EXISTS level_25_series;
  `);
  
  console.log('✅ Migration 018_rebirth_and_series rolled back');
};
