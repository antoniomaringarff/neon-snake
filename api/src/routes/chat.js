import { query } from '../config/database.js';

// Lista de palabras prohibidas (en español)
const BAD_WORDS = [
  'puto', 'puta', 'putos', 'putas',
  'hijo de puta', 'hijos de puta',
  'concha', 'conchas',
  'pelotudo', 'pelotuda', 'pelotudos', 'pelotudas',
  'boludo', 'boluda', 'boludos', 'boludas',
  'forro', 'forra', 'forros', 'forras',
  'gordo', 'gorda', 'gordos', 'gordas',
  'tonto', 'tonta', 'tontos', 'tontas',
  'idiota', 'idiotas',
  'estupido', 'estupida', 'estupidos', 'estupidas',
  'imbecil', 'imbeciles',
  'marica', 'maricon', 'maricones',
  'culiao', 'culiaos',
  'chupame', 'chupame la',
  'mamame', 'mamame la',
  'coger', 'cogiendo', 'cogiste',
  'follar', 'follando', 'follaste',
  'joder', 'jodete', 'jodido',
  'mierda', 'mierdas',
  'carajo', 'carajos',
  'verga', 'vergas',
  'pene', 'penes',
  'pito', 'pitos',
  'coño', 'coños',
  'cabron', 'cabrones',
  'gilipollas',
  'capullo', 'capullos',
  'mamahuevo', 'mamahuevos',
  'hijueputa', 'hijueputas',
  'malparido', 'malparidos',
  'hdp', 'h d p'
];

// Función para detectar si hay palabras malas
function hasBadWords(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const word of BAD_WORDS) {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    if (regex.test(message)) {
      return true;
    }
  }
  
  return false;
}

// Función para censurar palabras
function censorMessage(message) {
  let censored = message;
  
  // Crear regex para cada palabra, ignorando mayúsculas/minúsculas y acentos
  BAD_WORDS.forEach(word => {
    // Escapar caracteres especiales para regex
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Buscar la palabra completa (no como parte de otra palabra)
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    // Reemplazar con un símbolo simple
    censored = censored.replace(regex, '***');
  });
  
  return censored;
}

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
          cm.created_at,
          COALESCE(u.is_admin, false) as is_admin
         FROM chat_messages cm
         LEFT JOIN users u ON cm.user_id = u.id
         ORDER BY cm.created_at DESC
         LIMIT $1`,
        [Math.min(parseInt(limit), 100)] // Max 100 messages
      );

      // Return in chronological order (oldest first)
      return result.rows.reverse().map(row => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        message: row.message, // Ya viene censurado de la BD
        createdAt: row.created_at,
        isAdmin: row.is_admin === true || row.is_admin === 'true' || row.is_admin === 1
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
        'SELECT id, username, COALESCE(is_admin, false) as is_admin, COALESCE(is_banned, false) as is_banned, banned_until FROM users WHERE id = $1',
        [request.user.id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Verificar si el usuario está baneado
      const now = new Date();
      const isTemporarilyBanned = user.banned_until && new Date(user.banned_until) > now;
      const isPermanentlyBanned = user.is_banned && !user.banned_until;
      
      // Si el baneo temporal expiró, desbanear automáticamente
      if (user.banned_until && new Date(user.banned_until) <= now) {
        await query(
          'UPDATE users SET is_banned = false, banned_until = NULL WHERE id = $1',
          [user.id]
        );
      } else if (isTemporarilyBanned || isPermanentlyBanned) {
        const bannedUntil = user.banned_until ? new Date(user.banned_until) : null;
        const minutesLeft = bannedUntil ? Math.ceil((bannedUntil - now) / 1000 / 60) : null;
        
        return reply.code(403).send({ 
          error: bannedUntil ? `You are banned for ${minutesLeft} more minutes` : 'You are banned',
          isBanned: true,
          bannedUntil: bannedUntil ? bannedUntil.toISOString() : null
        });
      }

      // Verificar si el mensaje contiene palabras malas
      const messageTrimmed = message.trim();
      const containsBadWords = hasBadWords(messageTrimmed);

      // Si contiene palabras malas, banear al usuario por 15 minutos (banea toda la cuenta)
      if (containsBadWords) {
        const bannedUntil = new Date();
        bannedUntil.setMinutes(bannedUntil.getMinutes() + 15);
        
        await query(
          `UPDATE users 
           SET banned_until = $1, is_banned = true
           WHERE id = $2`,
          [bannedUntil, user.id]
        );
        
        // Censurar el mensaje antes de guardarlo
        const censoredMessage = censorMessage(messageTrimmed);
        
        // Insert message
        const result = await query(
          `INSERT INTO chat_messages (user_id, username, message)
           VALUES ($1, $2, $3)
           RETURNING id, user_id, username, message, created_at`,
          [user.id, user.username, censoredMessage]
        );

        const newMessage = result.rows[0];

        return {
          id: newMessage.id,
          userId: newMessage.user_id,
          username: newMessage.username,
          message: newMessage.message, // Mensaje censurado
          createdAt: newMessage.created_at,
          isAdmin: user.is_admin === true || user.is_admin === 'true' || user.is_admin === 1,
          banned: true,
          bannedUntil: bannedUntil.toISOString()
        };
      }

      // Censurar el mensaje antes de guardarlo (por si acaso)
      const censoredMessage = censorMessage(messageTrimmed);

      // Insert message
      const result = await query(
        `INSERT INTO chat_messages (user_id, username, message)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, username, message, created_at`,
        [user.id, user.username, censoredMessage]
      );

      const newMessage = result.rows[0];

      return {
        id: newMessage.id,
        userId: newMessage.user_id,
        username: newMessage.username,
        message: newMessage.message, // Mensaje censurado
        createdAt: newMessage.created_at,
        isAdmin: user.is_admin === true || user.is_admin === 'true' || user.is_admin === 1
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
