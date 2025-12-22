import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import leaderboardRoutes from './src/routes/leaderboard.js';
import sessionsRoutes from './src/routes/sessions.js';
import shopRoutes from './src/routes/shop.js';
import adminRoutes from './src/routes/admin.js';

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
fastify.register(shopRoutes, { prefix: '/api/shop' });
fastify.register(adminRoutes, { prefix: '/api/admin' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  // Asegurar que siempre devolvemos JSON
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation error',
      details: error.validation
    });
  }
  
  // Manejar errores de base de datos
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return reply.code(500).send({
      error: 'Database connection error. Please check if PostgreSQL is running.'
    });
  }
  
  reply.code(statusCode).send({
    error: message
  });
});

// Run migrations before starting server
// Se ejecutan siempre a menos que SKIP_MIGRATIONS=true
const runMigrationsOnStart = async () => {
  if (process.env.SKIP_MIGRATIONS !== 'true') {
    try {
      console.log('📊 Ejecutando migraciones de base de datos...');
      const { runMigrations } = await import('./src/migrations/run.js');
      await runMigrations();
      console.log('✅ Migraciones completadas');
    } catch (error) {
      console.error('⚠️  Error ejecutando migraciones:', error.message);
      console.error('   Stack:', error.stack);
      // No bloqueamos el inicio del servidor si las migraciones fallan
      // (puede que ya estén ejecutadas o haya un problema temporal)
    }
  } else {
    console.log('⏭️  Migraciones omitidas (SKIP_MIGRATIONS=true)');
  }
};

// Start server
const start = async () => {
  try {
    // Run migrations first in production
    await runMigrationsOnStart();
    
    const port = process.env.PORT || 3003;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Server running on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
