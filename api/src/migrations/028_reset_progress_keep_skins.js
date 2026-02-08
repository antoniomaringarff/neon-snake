// Migration 028: Reset all progress to initial state, but keep skins
// - Reset XP, stars, level, rebirths, series
// - Reset all upgrades to level 1 (initial state)
// - Reset leaderboard
// - Skins are stored in localStorage (frontend), so they are automatically preserved

export const up = async (pool) => {
  await pool.query(`
    -- Reset all user progress to initial state (level 1, upgrades at 1)
    -- Skins are preserved because they're stored in localStorage (frontend)
    
    -- Reset users table: XP, stars, rebirths, series
    UPDATE users
    SET total_xp = 0,
        total_stars = 0,
        rebirth_count = 0,
        current_series = 1,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset user_progress table: level 1, all upgrades at 1 (initial state)
    UPDATE user_progress
    SET current_level = 1,
        shield_level = 1,
        head_level = 2,  -- head starts at 2 (1 base + 1)
        cannon_level = 1,
        magnet_level = 1,
        speed_level = 1,
        bullet_speed_level = 1,
        health_level = 1,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset leaderboard table
    UPDATE leaderboard
    SET best_score = 0,
        highest_level = 1,
        total_xp = 0,
        total_sessions = 0,
        level_25_score = NULL,
        level_25_kills = NULL,
        level_25_series = NULL,
        last_updated = CURRENT_TIMESTAMP;
    
    -- Note: game_sessions history is preserved for analytics
    -- Skins are preserved because they're in localStorage (frontend)
  `);

  console.log('✅ Migration 028_reset_progress_keep_skins completed - All progress reset to initial state, skins preserved');
};

export const down = async (pool) => {
  // No hay forma de recuperar los datos reseteados, así que esta migración no se puede revertir
  console.log('⚠️  Migration 028_reset_progress_keep_skins cannot be rolled back - data was permanently reset');
};
