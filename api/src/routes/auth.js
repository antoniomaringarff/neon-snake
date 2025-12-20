import bcrypt from 'bcrypt';
import { query } from '../config/database.js';

export default async function authRoutes(fastify, options) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { username, email, password } = request.body;

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }

    try {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert user
      const result = await query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email, passwordHash]
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
        'SELECT id, username, email, password_hash, total_xp FROM users WHERE username = $1 OR email = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

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

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          totalXp: user.total_xp
        },
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      // Asegurar que siempre devolvemos JSON
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return reply.code(500).send({ error: 'Database connection error' });
      }
      // Re-lanzar el error para que el error handler de Fastify lo maneje
      reply.code(500).send({ error: error.message || 'Internal server error' });
    }
  });

  // Get current user
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const result = await query(
        'SELECT id, username, email, total_xp, created_at FROM users WHERE id = $1',
        [request.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const user = result.rows[0];

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        totalXp: user.total_xp,
        createdAt: user.created_at
      };
    } catch (error) {
      throw error;
    }
  });
}
