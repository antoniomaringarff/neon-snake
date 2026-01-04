export const up = async (pool) => {
  await pool.query(`
    -- Reset all user progress to zero/default values
    
    -- Reset total_xp and total_stars in users table
    UPDATE users
    SET total_xp = 0,
        total_stars = 0,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset user_progress table
    UPDATE user_progress
    SET shield_level = 0,
        head_level = 1,
        cannon_level = 0,
        magnet_level = 0,
        speed_level = 0,
        bullet_speed_level = 0,
        health_level = 0,
        current_level = 1,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Reset leaderboard table
    UPDATE leaderboard
    SET best_score = 0,
        highest_level = 1,
        total_xp = 0,
        total_sessions = 0,
        last_updated = CURRENT_TIMESTAMP;
    
    -- Optional: Clear game_sessions history (comentado por si quieres mantener el historial)
    -- DELETE FROM game_sessions;
  `);

  console.log('✅ Migration 016_reset_all_progress completed - All user progress reset to zero');
};

export const down = async (pool) => {
  // No hay forma de recuperar los datos reseteados, así que esta migración no se puede revertir
  console.log('⚠️  Migration 016_reset_all_progress cannot be rolled back - data was permanently reset');
};

