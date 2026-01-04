export const up = async (pool) => {
  await pool.query(`
    -- Update the leaderboard trigger to track level_25_score
    DROP TRIGGER IF EXISTS trigger_update_leaderboard ON game_sessions;
    DROP FUNCTION IF EXISTS update_leaderboard();

    CREATE OR REPLACE FUNCTION update_leaderboard()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Siempre actualizar highest_level, total_xp, total_sessions
      INSERT INTO leaderboard (
        user_id, 
        best_score, 
        highest_level, 
        total_xp, 
        total_sessions,
        level_25_score,
        level_25_kills,
        level_25_series,
        last_updated
      )
      VALUES (
        NEW.user_id,
        CASE WHEN NEW.level_reached = 25 THEN NEW.score ELSE 0 END,
        NEW.level_reached,
        NEW.xp_earned,
        1,
        CASE WHEN NEW.level_reached = 25 THEN NEW.score ELSE 0 END,
        CASE WHEN NEW.level_reached = 25 THEN COALESCE(NEW.kills_count, 0) ELSE 0 END,
        CASE WHEN NEW.level_reached = 25 THEN COALESCE(NEW.series_number, 1) ELSE 0 END,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        best_score = CASE 
          WHEN NEW.level_reached = 25 THEN GREATEST(leaderboard.best_score, NEW.score)
          ELSE leaderboard.best_score
        END,
        highest_level = GREATEST(leaderboard.highest_level, NEW.level_reached),
        total_xp = leaderboard.total_xp + NEW.xp_earned,
        total_sessions = leaderboard.total_sessions + 1,
        -- Actualizar level_25_score solo si es mejor que el anterior
        level_25_score = CASE 
          WHEN NEW.level_reached = 25 AND NEW.score > leaderboard.level_25_score 
          THEN NEW.score
          ELSE leaderboard.level_25_score
        END,
        -- Actualizar kills y series solo cuando hay nuevo récord
        level_25_kills = CASE 
          WHEN NEW.level_reached = 25 AND NEW.score > leaderboard.level_25_score 
          THEN COALESCE(NEW.kills_count, 0)
          ELSE leaderboard.level_25_kills
        END,
        level_25_series = CASE 
          WHEN NEW.level_reached = 25 AND NEW.score > leaderboard.level_25_score 
          THEN COALESCE(NEW.series_number, 1)
          ELSE leaderboard.level_25_series
        END,
        last_updated = CURRENT_TIMESTAMP;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_update_leaderboard
    AFTER INSERT ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_leaderboard();
  `);

  console.log('✅ Migration 019_update_leaderboard_level25 completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Restore previous trigger from migration 015
    DROP TRIGGER IF EXISTS trigger_update_leaderboard ON game_sessions;
    DROP FUNCTION IF EXISTS update_leaderboard();

    CREATE OR REPLACE FUNCTION update_leaderboard()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO leaderboard (user_id, best_score, highest_level, total_xp, total_sessions, last_updated)
      VALUES (
        NEW.user_id,
        CASE WHEN NEW.level_reached = 25 THEN NEW.score ELSE 0 END,
        NEW.level_reached,
        NEW.xp_earned,
        1,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO UPDATE SET
        best_score = CASE 
          WHEN NEW.level_reached = 25 THEN GREATEST(leaderboard.best_score, NEW.score)
          ELSE leaderboard.best_score
        END,
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
  `);

  console.log('✅ Migration 019_update_leaderboard_level25 rolled back');
};
