export const up = async (pool) => {
  await pool.query(`
    -- Update the leaderboard trigger to only update best_score when level_reached = 25
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

  console.log('✅ Migration 015_update_record_level25 completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Restore original trigger
    DROP TRIGGER IF EXISTS trigger_update_leaderboard ON game_sessions;
    DROP FUNCTION IF EXISTS update_leaderboard();

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
  `);

  console.log('✅ Migration 015_update_record_level25 rolled back');
};

