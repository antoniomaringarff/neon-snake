import { query } from '../config/database.js';

export default async function usersRoutes(fastify, options) {
  // Get user progress
  fastify.get('/:id/progress', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    // Check if user is requesting their own data
    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await query(
        `SELECT 
          up.shield_level,
          up.head_level,
          up.cannon_level,
          up.magnet_level,
          up.speed_level,
          up.bullet_speed_level,
          up.current_level,
          u.total_xp,
          COALESCE(u.total_stars, 0) as total_stars,
          up.updated_at
        FROM user_progress up
        JOIN users u ON up.user_id = u.id
        WHERE up.user_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Progress not found' });
      }

      const progress = result.rows[0];

      return {
        shieldLevel: progress.shield_level,
        headLevel: progress.head_level,
        cannonLevel: progress.cannon_level,
        magnetLevel: progress.magnet_level || 0,
        speedLevel: progress.speed_level || 0,
        bulletSpeedLevel: progress.bullet_speed_level || 0,
        currentLevel: progress.current_level,
        totalXp: progress.total_xp || 0,
        totalStars: progress.total_stars || 0,
        updatedAt: progress.updated_at
      };
    } catch (error) {
      throw error;
    }
  });

  // Update user progress
  fastify.put('/:id/progress', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { shieldLevel, headLevel, cannonLevel, magnetLevel, speedLevel, bulletSpeedLevel, currentLevel, totalXp, totalStars } = request.body;

    // Check if user is updating their own data
    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      // Update progress
      await query(
        `UPDATE user_progress 
         SET shield_level = $1, 
             head_level = $2, 
             cannon_level = $3,
             magnet_level = $4,
             speed_level = $5,
             bullet_speed_level = $6,
             current_level = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $8`,
        [shieldLevel, headLevel, cannonLevel, magnetLevel || 0, speedLevel || 0, bulletSpeedLevel || 0, currentLevel, id]
      );

      // Update total XP (this will trigger the function to update users table)
      await query(
        'UPDATE user_progress SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [id]
      );

      // Manually update total_xp and total_stars in users table
      await query(
        'UPDATE users SET total_xp = $1, total_stars = $2 WHERE id = $3',
        [totalXp || 0, totalStars || 0, id]
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Get user statistics
  fastify.get('/:id/stats', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_sessions,
          MAX(score) as best_score,
          MAX(level_reached) as highest_level,
          SUM(xp_earned) as total_xp_earned,
          AVG(score) as avg_score,
          SUM(duration_seconds) as total_play_time
        FROM game_sessions
        WHERE user_id = $1`,
        [id]
      );

      const stats = result.rows[0];

      return {
        totalSessions: parseInt(stats.total_sessions) || 0,
        bestScore: stats.best_score || 0,
        highestLevel: stats.highest_level || 1,
        totalXpEarned: parseInt(stats.total_xp_earned) || 0,
        avgScore: parseFloat(stats.avg_score) || 0,
        totalPlayTime: parseInt(stats.total_play_time) || 0
      };
    } catch (error) {
      throw error;
    }
  });
}
