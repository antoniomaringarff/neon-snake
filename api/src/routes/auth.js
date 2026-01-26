import bcrypt from 'bcrypt';
import { query } from '../config/database.js';

export default async function authRoutes(fastify, options) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { username, email, password } = request.body;

    // Email es opcional, solo username y password son obligatorios
    if (!username || !password) {
      return reply.code(400).send({ error: 'Se requiere usuario y contraseña' });
    }

    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }

    try {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert user (email puede ser null)
      const result = await query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email || null, passwordHash]
      );

      const user = result.rows[0];

      // Generate JWT
      const token = fastify.jwt.sign({ 
        id: user.id, 
        username: user.username 
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at
        },
        token
      };
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({ 
          error: 'Username or email already exists' 
        });
      }
      throw error;
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.code(400).send({ error: 'Missing username or password' });
    }

    try {
      // Find user by username or email
      const result = await query(
        'SELECT id, username, email, password_hash, COALESCE(total_xp, 0) as total_xp, COALESCE(total_stars, 0) as total_stars, COALESCE(is_banned, false) as is_banned, COALESCE(is_admin, false) as is_admin, COALESCE(free_shots, false) as free_shots, COALESCE(is_immune, false) as is_immune, banned_until FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Check if user is banned (temporary or permanent)
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
          error: bannedUntil ? `Account suspended for ${minutesLeft} more minutes` : 'Account suspended',
          isBanned: true,
          bannedUntil: bannedUntil ? bannedUntil.toISOString() : null
        });
      }

      // Verify password
      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = fastify.jwt.sign({ 
        id: user.id, 
        username: user.username 
      });

      // Verificar nuevamente el estado de baneo después de desbanear si expiró
      const finalBannedUntil = user.banned_until && new Date(user.banned_until) > now ? user.banned_until : null;
      const finalIsBanned = user.is_banned && !finalBannedUntil;

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          totalXp: user.total_xp || 0,
          totalStars: user.total_stars || 0
        },
        token,
        isAdmin: user.is_admin === true || user.is_admin === 'true' || user.is_admin === 1,
        isBanned: finalIsBanned,
        bannedUntil: finalBannedUntil ? new Date(finalBannedUntil).toISOString() : null,
        freeShots: user.free_shots === true || user.free_shots === 'true' || user.free_shots === 1,
        isImmune: user.is_immune === true || user.is_immune === 'true' || user.is_immune === 1
      };
    } catch (error) {
      console.error('Login error:', error);
      // Asegurar que siempre devolvemos JSON
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return reply.code(500).send({ error: 'Database connection error' });
      }
      // Devolver error con mensaje descriptivo
      return reply.code(500).send({ error: error.message || 'Internal server error' });
    }
  });

  // Get current user
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const result = await query(
        'SELECT id, username, email, total_xp, created_at, COALESCE(is_banned, false) as is_banned, COALESCE(is_admin, false) as is_admin, COALESCE(free_shots, false) as free_shots, COALESCE(is_immune, false) as is_immune, banned_until FROM users WHERE id = $1',
        [request.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const user = result.rows[0];

      // Verificar si el baneo temporal expiró
      const now = new Date();
      if (user.banned_until && new Date(user.banned_until) <= now) {
        await query(
          'UPDATE users SET is_banned = false, banned_until = NULL WHERE id = $1',
          [user.id]
        );
        user.is_banned = false;
        user.banned_until = null;
      }

      const isTemporarilyBanned = user.banned_until && new Date(user.banned_until) > now;
      const isBanned = (user.is_banned && !user.banned_until) || isTemporarilyBanned;

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        totalXp: user.total_xp,
        createdAt: user.created_at,
        isBanned: isBanned,
        bannedUntil: user.banned_until ? new Date(user.banned_until).toISOString() : null,
        isAdmin: user.is_admin === true || user.is_admin === 'true' || user.is_admin === 1,
        freeShots: user.free_shots === true || user.free_shots === 'true' || user.free_shots === 1,
        isImmune: user.is_immune === true || user.is_immune === 'true' || user.is_immune === 1
      };
    } catch (error) {
      throw error;
    }
  });
}
