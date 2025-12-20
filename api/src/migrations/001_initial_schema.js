export const up = async (pool) => {
  await pool.query(`
    -- Table: users
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      total_xp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table: user_progress
    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      shield_level INTEGER DEFAULT 0 CHECK (shield_level >= 0 AND shield_level <= 2),
      head_level INTEGER DEFAULT 1 CHECK (head_level >= 1 AND head_level <= 3),
      cannon_level INTEGER DEFAULT 0 CHECK (cannon_level >= 0 AND cannon_level <= 2),
      current_level INTEGER DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table: game_sessions
    CREATE TABLE IF NOT EXISTS game_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      level_reached INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL,
      duration_seconds INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Table: leaderboard
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      best_score INTEGER DEFAULT 0,
      highest_level INTEGER DEFAULT 1,
      total_xp INTEGER DEFAULT 0,
      total_sessions INTEGER DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_best_score ON leaderboard(best_score DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_highest_level ON leaderboard(highest_level DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_total_xp ON leaderboard(total_xp DESC);

    -- Function to update leaderboard after game session
    CREATE OR REPLACE FUNCTION update_leaderboard()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO leaderboard (user_id, best_score, highest_level, total_xp, total_sessions, last_updated)
      VALUES (
        NEW.user_id,
        NEW.score,
        NEW.level_reached,
        NEW.xp_earned,
        1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        best_score = GREATEST(leaderboard.best_score, NEW.score),
        highest_level = GREATEST(leaderboard.highest_level, NEW.level_reached),
        total_xp = leaderboard.total_xp + NEW.xp_earned,
        total_sessions = leaderboard.total_sessions + 1,
        last_updated = CURRENT_TIMESTAMP;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_update_leaderboard
    AFTER INSERT ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard();

    -- Trigger to auto-create user_progress on user creation
    CREATE OR REPLACE FUNCTION create_user_progress()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO user_progress (user_id) VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_create_user_progress
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_progress();
  `);

  console.log('✅ Migration 001_initial_schema completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP TRIGGER IF EXISTS trigger_create_user_progress ON users;
    DROP TRIGGER IF EXISTS trigger_update_leaderboard ON game_sessions;
    DROP FUNCTION IF EXISTS create_user_progress();
    DROP FUNCTION IF EXISTS update_leaderboard();
    DROP TABLE IF EXISTS game_sessions CASCADE;
    DROP TABLE IF EXISTS leaderboard CASCADE;
    DROP TABLE IF EXISTS user_progress CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);

  console.log('✅ Migration 001_initial_schema rolled back');
};
