import { query } from '../config/database.js';

export default async function chatRoutes(fastify, options) {
  // Get recent chat messages
  fastify.get('/', async (request, reply) => {
    const { limit = 50 } = request.query;

    try {
      const result = await query(
        `SELECT 
          cm.id,
          cm.user_id,
          cm.username,
          cm.message,
          cm.created_at
         FROM chat_messages cm
         ORDER BY cm.created_at DESC
         LIMIT $1`,
        [Math.min(parseInt(limit), 100)] // Max 100 messages
      );

      // Return in chronological order (oldest first)
      return result.rows.reverse().map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        message: row.message,
        createdAt: row.created_at
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Send a chat message
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { message } = request.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return reply.code(400).send({ error: 'Message too long (max 500 characters)' });
    }

    try {
      // Get user info
      const userResult = await query(
        'SELECT id, username FROM users WHERE id = $1',
        [request.user.id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Insert message
      const result = await query(
        `INSERT INTO chat_messages (user_id, username, message)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, username, message, created_at`,
        [user.id, user.username, message.trim()]
      );

      const newMessage = result.rows[0];

      return {
        id: newMessage.id,
        userId: newMessage.user_id,
        username: newMessage.username,
        message: newMessage.message,
        createdAt: newMessage.created_at
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Delete a message (admin only or own message)
  fastify.delete('/:messageId', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { messageId } = request.params;

    try {
      // Check if user is admin
      const userResult = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [request.user.id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const isAdmin = userResult.rows[0].is_admin || false;

      // Get message to check ownership
      const messageResult = await query(
        'SELECT user_id FROM chat_messages WHERE id = $1',
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Message not found' });
      }

      const messageUserId = messageResult.rows[0].user_id;

      // Check if user can delete (admin or own message)
      if (!isAdmin && messageUserId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Delete message
      await query(
        'DELETE FROM chat_messages WHERE id = $1',
        [messageId]
      );

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });
}
