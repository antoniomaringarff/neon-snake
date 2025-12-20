import { query } from '../config/database.js';

export default async function sessionsRoutes(fastify, options) {
  // Save game session
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { score, levelReached, xpEarned, durationSeconds } = request.body;
    const userId = request.user.id;

    if (!score || !levelReached || !xpEarned) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    try {
      const result = await query(
        `INSERT INTO game_sessions (user_id, score, level_reached, xp_earned, duration_seconds)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [userId, score, levelReached, xpEarned, durationSeconds || 0]
      );

      const session = result.rows[0];

      return {
        id: session.id,
        createdAt: session.created_at
      };
    } catch (error) {
      throw error;
    }
  });

  // Get user's session history
  fastify.get('/history', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id;
    const { limit = 10, offset = 0 } = request.query;

    try {
      const result = await query(
        `SELECT id, score, level_reached, xp_earned, duration_seconds, created_at
         FROM game_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows.map(session => ({
        id: session.id,
        score: session.score,
        levelReached: session.level_reached,
        xpEarned: session.xp_earned,
        durationSeconds: session.duration_seconds,
        createdAt: session.created_at
      }));
    } catch (error) {
      throw error;
    }
  });

  // Get recent sessions (last 24 hours)
  fastify.get('/recent', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id;

    try {
      const result = await query(
        `SELECT id, score, level_reached, xp_earned, duration_seconds, created_at
         FROM game_sessions
         WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '24 hours'
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(session => ({
        id: session.id,
        score: session.score,
        levelReached: session.level_reached,
        xpEarned: session.xp_earned,
        durationSeconds: session.duration_seconds,
        createdAt: session.created_at
      }));
    } catch (error) {
      throw error;
    }
  });
}
