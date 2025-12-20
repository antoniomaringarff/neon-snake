import { query } from '../config/database.js';

export default async function leaderboardRoutes(fastify, options) {
  // Get leaderboard
  fastify.get('/', async (request, reply) => {
    const { type = 'score', limit = 10 } = request.query;

    let orderBy;
    switch (type) {
      case 'level':
        orderBy = 'highest_level';
        break;
      case 'xp':
        orderBy = 'total_xp';
        break;
      case 'sessions':
        orderBy = 'total_sessions';
        break;
      default:
        orderBy = 'best_score';
    }

    try {
      const result = await query(
        `SELECT 
          l.id,
          u.username,
          l.best_score,
          l.highest_level,
          l.total_xp,
          l.total_sessions,
          l.last_updated
         FROM leaderboard l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.${orderBy} DESC
         LIMIT $1`,
        [Math.min(parseInt(limit), 100)] // Max 100
      );

      return result.rows.map((row, index) => ({
        rank: index + 1,
        username: row.username,
        bestScore: row.best_score,
        highestLevel: row.highest_level,
        totalXp: row.total_xp,
        totalSessions: row.total_sessions,
        lastUpdated: row.last_updated
      }));
    } catch (error) {
      throw error;
    }
  });

  // Get user's rank
  fastify.get('/rank/:userId', async (request, reply) => {
    const { userId } = request.params;
    const { type = 'score' } = request.query;

    let orderBy;
    switch (type) {
      case 'level':
        orderBy = 'highest_level';
        break;
      case 'xp':
        orderBy = 'total_xp';
        break;
      case 'sessions':
        orderBy = 'total_sessions';
        break;
      default:
        orderBy = 'best_score';
    }

    try {
      const result = await query(
        `SELECT 
          rank,
          username,
          best_score,
          highest_level,
          total_xp,
          total_sessions
         FROM (
           SELECT 
             ROW_NUMBER() OVER (ORDER BY l.${orderBy} DESC) as rank,
             u.username,
             l.best_score,
             l.highest_level,
             l.total_xp,
             l.total_sessions,
             l.user_id
           FROM leaderboard l
           JOIN users u ON l.user_id = u.id
         ) ranked
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found in leaderboard' });
      }

      const data = result.rows[0];

      return {
        rank: parseInt(data.rank),
        username: data.username,
        bestScore: data.best_score,
        highestLevel: data.highest_level,
        totalXp: data.total_xp,
        totalSessions: data.total_sessions
      };
    } catch (error) {
      throw error;
    }
  });

  // Get top players around a specific user
  fastify.get('/around/:userId', async (request, reply) => {
    const { userId } = request.params;
    const { type = 'score', range = 5 } = request.query;

    let orderBy;
    switch (type) {
      case 'level':
        orderBy = 'highest_level';
        break;
      case 'xp':
        orderBy = 'total_xp';
        break;
      default:
        orderBy = 'best_score';
    }

    try {
      // First get user's rank
      const rankResult = await query(
        `SELECT rank FROM (
           SELECT 
             ROW_NUMBER() OVER (ORDER BY l.${orderBy} DESC) as rank,
             l.user_id
           FROM leaderboard l
         ) ranked
         WHERE user_id = $1`,
        [userId]
      );

      if (rankResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found in leaderboard' });
      }

      const userRank = parseInt(rankResult.rows[0].rank);
      const offset = Math.max(0, userRank - parseInt(range) - 1);

      // Get players around this rank
      const result = await query(
        `SELECT 
          u.username,
          l.best_score,
          l.highest_level,
          l.total_xp,
          l.total_sessions,
          l.user_id
         FROM leaderboard l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.${orderBy} DESC
         LIMIT $1 OFFSET $2`,
        [parseInt(range) * 2 + 1, offset]
      );

      return result.rows.map((row, index) => ({
        rank: offset + index + 1,
        username: row.username,
        bestScore: row.best_score,
        highestLevel: row.highest_level,
        totalXp: row.total_xp,
        totalSessions: row.total_sessions,
        isCurrentUser: row.user_id === parseInt(userId)
      }));
    } catch (error) {
      throw error;
    }
  });
}
