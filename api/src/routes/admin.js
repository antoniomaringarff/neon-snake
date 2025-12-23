import { query } from '../config/database.js';

// Middleware to verify admin access
const verifyAdmin = async (request, reply) => {
  try {
    await request.jwtVerify();
    
    if (!request.user || !request.user.id) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if user is admin from database
    const result = await query(
      'SELECT is_admin FROM users WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return reply.code(403).send({ error: 'Forbidden: Admin access required' });
    }
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
};

export default async function adminRoutes(fastify, options) {
  // Check if current user is admin
  fastify.get('/check', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const result = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [request.user.id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return { isAdmin: result.rows[0].is_admin || false };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Get all users with their stats
  fastify.get('/users', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT 
          u.id,
          u.username,
          u.email,
          u.total_xp,
          COALESCE(u.total_stars, 0) as total_stars,
          u.is_banned,
          u.is_admin,
          u.free_shots,
          u.created_at,
          l.best_score,
          l.highest_level,
          l.total_sessions,
          up.shield_level,
          up.head_level,
          up.cannon_level,
          up.magnet_level,
          up.speed_level,
          up.bullet_speed_level,
          up.health_level,
          up.current_level
        FROM users u
        LEFT JOIN leaderboard l ON u.id = l.user_id
        LEFT JOIN user_progress up ON u.id = up.user_id
        ORDER BY u.created_at DESC`
      );

      return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        totalXp: row.total_xp || 0,
        totalStars: row.total_stars || 0,
        isBanned: row.is_banned || false,
        createdAt: row.created_at,
        bestScore: row.best_score || 0,
        highestLevel: row.highest_level || 1,
        totalSessions: row.total_sessions || 0,
        shieldLevel: row.shield_level || 0,
        headLevel: row.head_level || 1,
        cannonLevel: row.cannon_level || 0,
        magnetLevel: row.magnet_level || 0,
        speedLevel: row.speed_level || 0,
        bulletSpeedLevel: row.bullet_speed_level || 0,
        healthLevel: row.health_level || 0,
        currentLevel: row.current_level || 1,
        isAdmin: row.is_admin || false,
        freeShots: row.free_shots || false
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Update user data
  fastify.put('/users/:id', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    const { id } = request.params;
      const {
      totalXp,
      totalStars,
      bestScore,
      shieldLevel,
      headLevel,
      cannonLevel,
      magnetLevel,
      speedLevel,
      bulletSpeedLevel,
      healthLevel,
      currentLevel,
      isBanned,
      isAdmin,
      freeShots
    } = request.body;

    try {
      // Update users table
      await query(
        `UPDATE users 
         SET total_xp = COALESCE($1, total_xp),
             total_stars = COALESCE($2, total_stars),
             is_banned = COALESCE($3, is_banned),
             is_admin = COALESCE($4, is_admin),
             free_shots = COALESCE($5, free_shots),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [totalXp, totalStars, isBanned, isAdmin, freeShots, id]
      );

      // Update user_progress
      if (shieldLevel !== undefined || headLevel !== undefined || cannonLevel !== undefined ||
          magnetLevel !== undefined || speedLevel !== undefined || bulletSpeedLevel !== undefined || 
          healthLevel !== undefined || currentLevel !== undefined) {
        await query(
          `UPDATE user_progress 
           SET shield_level = COALESCE($1, shield_level),
               head_level = COALESCE($2, head_level),
               cannon_level = COALESCE($3, cannon_level),
               magnet_level = COALESCE($4, magnet_level),
               speed_level = COALESCE($5, speed_level),
               bullet_speed_level = COALESCE($6, bullet_speed_level),
               health_level = COALESCE($7, health_level),
               current_level = COALESCE($8, current_level),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $9`,
          [shieldLevel, headLevel, cannonLevel, magnetLevel, speedLevel, bulletSpeedLevel, healthLevel, currentLevel, id]
        );
      }

      // Update leaderboard best_score if provided
      if (bestScore !== undefined) {
        await query(
          `INSERT INTO leaderboard (user_id, best_score, highest_level, total_xp, last_updated)
           VALUES ($1, $2, GREATEST($2, COALESCE((SELECT highest_level FROM leaderboard WHERE user_id = $1), 1)), 
                   COALESCE((SELECT total_xp FROM leaderboard WHERE user_id = $1), 0), CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO UPDATE SET
             best_score = GREATEST(leaderboard.best_score, $2),
             last_updated = CURRENT_TIMESTAMP`,
          [id, bestScore]
        );
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Get all levels
  fastify.get('/levels', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT 
          gl.id,
          gl.level_number,
          gl.stars_needed,
          gl.player_speed,
          gl.enemy_speed,
          gl.enemy_count,
          gl.enemy_density,
          gl.enemy_shoot_percentage,
          gl.enemy_shield_percentage,
          gl.enemy_shoot_cooldown,
          gl.xp_density,
          gl.background_type,
          gl.structure_id,
          gl.has_central_cell,
          gl.central_cell_opening_speed,
          gs.name as structure_name
        FROM game_levels gl
        LEFT JOIN game_structures gs ON gl.structure_id = gs.id
        ORDER BY gl.level_number`
      );

      return result.rows.map(row => ({
        id: row.id,
        levelNumber: row.level_number,
        starsNeeded: row.stars_needed,
        playerSpeed: parseFloat(row.player_speed),
        enemySpeed: parseFloat(row.enemy_speed),
        enemyCount: row.enemy_count,
        enemyDensity: row.enemy_density,
        enemyShootPercentage: row.enemy_shoot_percentage,
        enemyShieldPercentage: row.enemy_shield_percentage,
        enemyShootCooldown: row.enemy_shoot_cooldown,
        xpDensity: row.xp_density,
        backgroundType: row.background_type,
        structureId: row.structure_id,
        structureName: row.structure_name,
        hasCentralCell: row.has_central_cell,
        centralCellOpeningSpeed: parseFloat(row.central_cell_opening_speed)
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Update level configuration
  fastify.put('/levels/:id', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    const { id } = request.params;
    const {
      levelNumber,
      starsNeeded,
      playerSpeed,
      enemySpeed,
      enemyCount,
      enemyDensity,
      enemyShootPercentage,
      enemyShieldPercentage,
      enemyShootCooldown,
      xpDensity,
      backgroundType,
      structureId,
      hasCentralCell,
      centralCellOpeningSpeed
    } = request.body;

    try {
      const result = await query(
        `UPDATE game_levels 
         SET level_number = COALESCE($1, level_number),
             stars_needed = COALESCE($2, stars_needed),
             player_speed = COALESCE($3, player_speed),
             enemy_speed = COALESCE($4, enemy_speed),
             enemy_count = COALESCE($5, enemy_count),
             enemy_density = COALESCE($6, enemy_density),
             enemy_shoot_percentage = COALESCE($7, enemy_shoot_percentage),
             enemy_shield_percentage = COALESCE($8, enemy_shield_percentage),
             enemy_shoot_cooldown = COALESCE($9, enemy_shoot_cooldown),
             xp_density = COALESCE($10, xp_density),
             background_type = COALESCE($11, background_type),
             structure_id = $12,
             has_central_cell = COALESCE($13, has_central_cell),
             central_cell_opening_speed = COALESCE($14, central_cell_opening_speed),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $15
         RETURNING *`,
        [
          levelNumber, starsNeeded, playerSpeed, enemySpeed, enemyCount,
          enemyDensity, enemyShootPercentage, enemyShieldPercentage,
          enemyShootCooldown, xpDensity, backgroundType, structureId,
          hasCentralCell, centralCellOpeningSpeed, id
        ]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Level not found' });
      }

      const row = result.rows[0];
      return {
        id: row.id,
        levelNumber: row.level_number,
        starsNeeded: row.stars_needed,
        playerSpeed: parseFloat(row.player_speed),
        enemySpeed: parseFloat(row.enemy_speed),
        enemyCount: row.enemy_count,
        enemyDensity: row.enemy_density,
        enemyShootPercentage: row.enemy_shoot_percentage,
        enemyShieldPercentage: row.enemy_shield_percentage,
        enemyShootCooldown: row.enemy_shoot_cooldown,
        xpDensity: row.xp_density,
        backgroundType: row.background_type,
        structureId: row.structure_id,
        hasCentralCell: row.has_central_cell,
        centralCellOpeningSpeed: parseFloat(row.central_cell_opening_speed)
      };
    } catch (error) {
      fastify.log.error(error);
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({ error: 'Level number already exists' });
      }
      throw error;
    }
  });

  // Create new level
  fastify.post('/levels', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    const {
      levelNumber,
      starsNeeded = 1,
      playerSpeed = 2.0,
      enemySpeed = 2.0,
      enemyCount = 5,
      enemyDensity = 15,
      enemyShootPercentage = 0,
      enemyShieldPercentage = 0,
      enemyShootCooldown = 5000,
      xpDensity = 100,
      backgroundType = 'default',
      structureId = null,
      hasCentralCell = false,
      centralCellOpeningSpeed = 0.002
    } = request.body;

    if (!levelNumber) {
      return reply.code(400).send({ error: 'levelNumber is required' });
    }

    try {
      const result = await query(
        `INSERT INTO game_levels (
          level_number, stars_needed, player_speed, enemy_speed, enemy_count,
          enemy_density, enemy_shoot_percentage, enemy_shield_percentage,
          enemy_shoot_cooldown, xp_density, background_type, structure_id,
          has_central_cell, central_cell_opening_speed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          levelNumber, starsNeeded, playerSpeed, enemySpeed, enemyCount,
          enemyDensity, enemyShootPercentage, enemyShieldPercentage,
          enemyShootCooldown, xpDensity, backgroundType, structureId,
          hasCentralCell, centralCellOpeningSpeed
        ]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        levelNumber: row.level_number,
        starsNeeded: row.stars_needed,
        playerSpeed: parseFloat(row.player_speed),
        enemySpeed: parseFloat(row.enemy_speed),
        enemyCount: row.enemy_count,
        enemyDensity: row.enemy_density,
        enemyShootPercentage: row.enemy_shoot_percentage,
        enemyShieldPercentage: row.enemy_shield_percentage,
        enemyShootCooldown: row.enemy_shoot_cooldown,
        xpDensity: row.xp_density,
        backgroundType: row.background_type,
        structureId: row.structure_id,
        hasCentralCell: row.has_central_cell,
        centralCellOpeningSpeed: parseFloat(row.central_cell_opening_speed)
      };
    } catch (error) {
      fastify.log.error(error);
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({ error: 'Level number already exists' });
      }
      throw error;
    }
  });

  // Get all structures
  fastify.get('/structures', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    try {
      const result = await query(
        `SELECT id, name, description, config, created_at, updated_at
         FROM game_structures
         ORDER BY name`
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        config: row.config,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Create new structure
  fastify.post('/structures', {
    onRequest: [verifyAdmin]
  }, async (request, reply) => {
    const { name, description, config = {} } = request.body;

    if (!name) {
      return reply.code(400).send({ error: 'name is required' });
    }

    try {
      const result = await query(
        `INSERT INTO game_structures (name, description, config)
         VALUES ($1, $2, $3::jsonb)
         RETURNING *`,
        [name, description || null, JSON.stringify(config)]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        config: row.config,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      fastify.log.error(error);
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({ error: 'Structure name already exists' });
      }
      throw error;
    }
  });
}

