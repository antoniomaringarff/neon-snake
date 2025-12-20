import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import leaderboardRoutes from './src/routes/leaderboard.js';
import sessionsRoutes from './src/routes/sessions.js';

dotenv.config();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:8008',
  credentials: true
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-this'
});

// Decorator for authentication
fastify.decorate('authenticate', async function(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(usersRoutes, { prefix: '/api/users' });
fastify.register(leaderboardRoutes, { prefix: '/api/leaderboard' });
fastify.register(sessionsRoutes, { prefix: '/api/sessions' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.validation
    });
  }
  
  reply.code(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error'
  });
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3003;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
