import { query } from '../config/database.js';

export default async function arenaRoutes(fastify, options) {
  // Obtener configuración de arena activa
  fastify.get('/config', async (request, reply) => {
    try {
      const result = await query(
        `SELECT id, arena_type, arena_name, map_size, enemy_count, 
                enemy_shoot_percentage, enemy_shield_percentage, structures_count,
                killer_saw_count, floating_cannon_count, resentful_snake_count,
                health_box_count, is_active
         FROM arena_configs
         WHERE is_active = true
         ORDER BY created_at DESC
         LIMIT 1`
      );

      // Si no hay configuración en la DB, devolver valores por defecto
      // mapSize ahora significa "pantallas" no BASE_UNITS
      if (result.rows.length === 0) {
        return {
          id: 0,
          arenaType: 'battle_royale',
          arenaName: 'Arena Clásica',
          mapSize: 5, // 5x5 pantallas (25 pantallas totales)
          enemySpeed: 2.8,
          playerSpeed: 2.5,
          enemyShootPercentage: 50,
          enemyShieldPercentage: 50,
          enemyShootCooldown: 2000,
          enemyUpgradeLevel: 5,
          isActive: true
        };
      }

      const config = result.rows[0];
      return {
        id: config.id,
        arenaType: config.arena_type,
        arenaName: config.arena_name,
        mapSize: config.map_size,
        enemyCount: config.enemy_count,
        enemyShootPercentage: config.enemy_shoot_percentage,
        enemyShieldPercentage: config.enemy_shield_percentage,
        structuresCount: config.structures_count,
        killerSawCount: config.killer_saw_count,
        floatingCannonCount: config.floating_cannon_count,
        resentfulSnakeCount: config.resentful_snake_count,
        healthBoxCount: config.health_box_count,
        isActive: config.is_active
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Obtener leaderboard de arena
  fastify.get('/leaderboard', async (request, reply) => {
    const { type = 'best_xp', limit = 10 } = request.query;

    let orderBy;
    switch (type) {
      case 'total_kills':
        orderBy = 'total_kills';
        break;
      case 'total_xp':
        orderBy = 'total_xp';
        break;
      case 'best_kill_streak':
        orderBy = 'best_kill_streak';
        break;
      default:
        orderBy = 'best_xp';
    }

    try {
      const result = await query(
        `SELECT 
          l.id,
          u.username,
          l.best_xp,
          l.total_xp,
          l.total_kills,
          l.total_deaths,
          l.total_sessions,
          l.best_kill_streak,
          l.last_updated
         FROM arena_leaderboard l
         JOIN users u ON l.user_id = u.id
         ORDER BY l.${orderBy} DESC
         LIMIT $1`,
        [Math.min(parseInt(limit), 100)]
      );

      return result.rows.map((row, index) => ({
        rank: index + 1,
        username: row.username,
        bestXp: row.best_xp,
        totalXp: row.total_xp,
        totalKills: row.total_kills,
        totalDeaths: row.total_deaths,
        totalSessions: row.total_sessions,
        bestKillStreak: row.best_kill_streak,
        lastUpdated: row.last_updated
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Guardar sesión de arena (cuando el jugador muere)
  fastify.post('/sessions', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { arenaConfigId, xpEarned, killsCount, deathsCount, durationSeconds } = request.body;
    const userId = request.user.id;

    if (xpEarned === undefined || arenaConfigId === undefined) {
      return reply.code(400).send({ error: 'Missing required fields: arenaConfigId, xpEarned' });
    }

    try {
      const result = await query(
        `INSERT INTO arena_sessions (user_id, arena_config_id, xp_earned, kills_count, deaths_count, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [userId, arenaConfigId, xpEarned, killsCount || 0, deathsCount || 0, durationSeconds || 0]
      );

      const session = result.rows[0];

      return {
        id: session.id,
        createdAt: session.created_at
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Registrar kill entre jugadores
  fastify.post('/kills', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { arenaSessionId, victimUserId, killMethod, killerXpAtDeath, victimXpAtDeath } = request.body;
    const killerUserId = request.user.id;

    if (!arenaSessionId || !victimUserId || !killMethod) {
      return reply.code(400).send({ error: 'Missing required fields: arenaSessionId, victimUserId, killMethod' });
    }

    try {
      const result = await query(
        `INSERT INTO arena_kills (arena_session_id, killer_user_id, victim_user_id, kill_method, killer_xp_at_death, victim_xp_at_death)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [arenaSessionId, killerUserId, victimUserId, killMethod, killerXpAtDeath || 0, victimXpAtDeath || 0]
      );

      return {
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Obtener estadísticas del jugador en arena
  fastify.get('/stats/:userId', async (request, reply) => {
    const { userId } = request.params;

    try {
      // Estadísticas del leaderboard
      const leaderboardResult = await query(
        `SELECT best_xp, total_xp, total_kills, total_deaths, total_sessions, best_kill_streak
         FROM arena_leaderboard
         WHERE user_id = $1`,
        [userId]
      );

      // Últimas sesiones
      const sessionsResult = await query(
        `SELECT id, xp_earned, kills_count, deaths_count, duration_seconds, created_at
         FROM arena_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
      );

      // Kills recientes
      const killsResult = await query(
        `SELECT k.id, k.kill_method, k.killer_xp_at_death, k.victim_xp_at_death, k.created_at,
                u.username as victim_username
         FROM arena_kills k
         JOIN users u ON k.victim_user_id = u.id
         WHERE k.killer_user_id = $1
         ORDER BY k.created_at DESC
         LIMIT 10`,
        [userId]
      );

      // Muertes recientes
      const deathsResult = await query(
        `SELECT k.id, k.kill_method, k.killer_xp_at_death, k.victim_xp_at_death, k.created_at,
                u.username as killer_username
         FROM arena_kills k
         JOIN users u ON k.killer_user_id = u.id
         WHERE k.victim_user_id = $1
         ORDER BY k.created_at DESC
         LIMIT 10`,
        [userId]
      );

      const stats = leaderboardResult.rows[0] || {
        best_xp: 0,
        total_xp: 0,
        total_kills: 0,
        total_deaths: 0,
        total_sessions: 0,
        best_kill_streak: 0
      };

      return {
        leaderboard: {
          bestXp: stats.best_xp,
          totalXp: stats.total_xp,
          totalKills: stats.total_kills,
          totalDeaths: stats.total_deaths,
          totalSessions: stats.total_sessions,
          bestKillStreak: stats.best_kill_streak
        },
        recentSessions: sessionsResult.rows.map(session => ({
          id: session.id,
          xpEarned: session.xp_earned,
          killsCount: session.kills_count,
          deathsCount: session.deaths_count,
          durationSeconds: session.duration_seconds,
          createdAt: session.created_at
        })),
        recentKills: killsResult.rows.map(kill => ({
          id: kill.id,
          killMethod: kill.kill_method,
          victimUsername: kill.victim_username,
          killerXpAtDeath: kill.killer_xp_at_death,
          victimXpAtDeath: kill.victim_xp_at_death,
          createdAt: kill.created_at
        })),
        recentDeaths: deathsResult.rows.map(death => ({
          id: death.id,
          killMethod: death.kill_method,
          killerUsername: death.killer_username,
          killerXpAtDeath: death.killer_xp_at_death,
          victimXpAtDeath: death.victim_xp_at_death,
          createdAt: death.created_at
        }))
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });
}
