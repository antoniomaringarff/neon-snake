export const up = async (pool) => {
  await pool.query(`
    -- Configuración de arenas
    CREATE TABLE IF NOT EXISTS arena_configs (
      id SERIAL PRIMARY KEY,
      arena_type VARCHAR(50) NOT NULL,
      arena_name VARCHAR(100) NOT NULL,
      map_size INTEGER DEFAULT 100,
      enemy_count INTEGER DEFAULT 500,
      enemy_shoot_percentage INTEGER DEFAULT 50,
      enemy_shield_percentage INTEGER DEFAULT 50,
      structures_count INTEGER DEFAULT 20,
      killer_saw_count INTEGER DEFAULT 30,
      floating_cannon_count INTEGER DEFAULT 20,
      resentful_snake_count INTEGER DEFAULT 10,
      health_box_count INTEGER DEFAULT 50,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Sesiones de arena (cada vez que alguien muere)
    CREATE TABLE IF NOT EXISTS arena_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      arena_config_id INTEGER REFERENCES arena_configs(id),
      xp_earned INTEGER NOT NULL,
      kills_count INTEGER DEFAULT 0,
      deaths_count INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Registro de kills entre jugadores
    CREATE TABLE IF NOT EXISTS arena_kills (
      id SERIAL PRIMARY KEY,
      arena_session_id INTEGER REFERENCES arena_sessions(id) ON DELETE CASCADE,
      killer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      victim_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kill_method VARCHAR(50), -- 'bullet', 'body_collision', 'head_collision'
      killer_xp_at_death INTEGER,
      victim_xp_at_death INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Leaderboard de arena (acumulativo)
    CREATE TABLE IF NOT EXISTS arena_leaderboard (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      best_xp INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      total_deaths INTEGER DEFAULT 0,
      total_sessions INTEGER DEFAULT 0,
      best_kill_streak INTEGER DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Índices para performance
    CREATE INDEX IF NOT EXISTS idx_arena_sessions_user_id ON arena_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_arena_sessions_created_at ON arena_sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_arena_kills_killer_user_id ON arena_kills(killer_user_id);
    CREATE INDEX IF NOT EXISTS idx_arena_kills_victim_user_id ON arena_kills(victim_user_id);
    CREATE INDEX IF NOT EXISTS idx_arena_kills_created_at ON arena_kills(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_arena_leaderboard_best_xp ON arena_leaderboard(best_xp DESC);
    CREATE INDEX IF NOT EXISTS idx_arena_leaderboard_total_kills ON arena_leaderboard(total_kills DESC);

    -- Insertar configuración de arena por defecto
    -- map_size ahora significa "pantallas" (10x10 = mapa grande pero manejable)
    INSERT INTO arena_configs (arena_type, arena_name, map_size, enemy_count, enemy_shoot_percentage, enemy_shield_percentage, structures_count, killer_saw_count, floating_cannon_count, resentful_snake_count, health_box_count, is_active)
    VALUES ('battle_royale', 'Arena Clásica', 10, 500, 50, 50, 25, 30, 25, 15, 50, true)
    ON CONFLICT DO NOTHING;

    -- Función para actualizar leaderboard de arena después de una sesión
    CREATE OR REPLACE FUNCTION update_arena_leaderboard()
    RETURNS TRIGGER AS $$
    DECLARE
      current_kill_streak INTEGER;
      new_kill_streak INTEGER;
    BEGIN
      -- Obtener el kill streak actual del jugador
      SELECT COALESCE(best_kill_streak, 0) INTO current_kill_streak
      FROM arena_leaderboard
      WHERE user_id = NEW.user_id;

      -- Calcular nuevo kill streak (kills en esta sesión)
      new_kill_streak := NEW.kills_count;

      INSERT INTO arena_leaderboard (user_id, best_xp, total_xp, total_kills, total_deaths, total_sessions, best_kill_streak, last_updated)
      VALUES (
        NEW.user_id,
        NEW.xp_earned,
        NEW.xp_earned,
        NEW.kills_count,
        NEW.deaths_count,
        1,
        GREATEST(current_kill_streak, new_kill_streak),
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        best_xp = GREATEST(arena_leaderboard.best_xp, NEW.xp_earned),
        total_xp = arena_leaderboard.total_xp + NEW.xp_earned,
        total_kills = arena_leaderboard.total_kills + NEW.kills_count,
        total_deaths = arena_leaderboard.total_deaths + NEW.deaths_count,
        total_sessions = arena_leaderboard.total_sessions + 1,
        best_kill_streak = GREATEST(arena_leaderboard.best_kill_streak, new_kill_streak),
        last_updated = CURRENT_TIMESTAMP;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Trigger para actualizar leaderboard automáticamente
    CREATE TRIGGER trigger_update_arena_leaderboard
    AFTER INSERT ON arena_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_arena_leaderboard();
  `);

  console.log('✅ Migration 023_arena_system completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP TRIGGER IF EXISTS trigger_update_arena_leaderboard ON arena_sessions;
    DROP FUNCTION IF EXISTS update_arena_leaderboard();
    DROP TABLE IF EXISTS arena_kills CASCADE;
    DROP TABLE IF EXISTS arena_sessions CASCADE;
    DROP TABLE IF EXISTS arena_leaderboard CASCADE;
    DROP TABLE IF EXISTS arena_configs CASCADE;
  `);

  console.log('✅ Migration 023_arena_system rolled back');
};
