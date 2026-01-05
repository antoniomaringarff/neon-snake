import { query } from '../config/database.js';

export default async function usersRoutes(fastify, options) {
  // Rebirth - reiniciar progreso con ventajas
  fastify.post('/:id/rebirth', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    
    // Verificar que el usuario puede hacer rebirth
    // Debe haber completado el nivel 25 al menos una vez (highest_level >= 25)
    const leaderboardResult = await query(
      'SELECT highest_level FROM leaderboard WHERE user_id = $1',
      [id]
    );
    
    if (leaderboardResult.rows.length === 0 || leaderboardResult.rows[0].highest_level < 25) {
      return reply.code(400).send({ error: 'Debes completar el nivel 25 para hacer rebirth' });
    }
    
    try {
      // Incrementar rebirth_count y series
      await query(`
        UPDATE users 
        SET rebirth_count = rebirth_count + 1,
            current_series = current_series + 1,
            total_xp = 0,
            total_stars = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
      
      // Obtener el nuevo rebirth_count
      const rebirthResult = await query(
        'SELECT rebirth_count, current_series FROM users WHERE id = $1',
        [id]
      );
      const rebirthCount = rebirthResult.rows[0].rebirth_count;
      const currentSeries = rebirthResult.rows[0].current_series;
      
      // Resetear progreso a nivel 1, pero con los upgrades según rebirth_count
      // Los niveles base de la tienda serán rebirth_count (0->1->2->3...)
      await query(`
        UPDATE user_progress
        SET current_level = 1,
            shield_level = $2,
            head_level = 1 + $2,
            cannon_level = $2,
            magnet_level = $2,
            speed_level = $2,
            bullet_speed_level = $2,
            health_level = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [id, rebirthCount]);
      
      return {
        message: 'Rebirth completado',
        rebirthCount: rebirthCount,
        currentSeries: currentSeries,
        startingLevel: rebirthCount
      };
    } catch (error) {
      console.error('Error en rebirth:', error);
      return reply.code(500).send({ error: 'Error al procesar rebirth' });
    }
  });

  // Get user progress
  fastify.get('/:id/progress', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    // Check if user is requesting their own data
    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await query(
        `SELECT 
          up.shield_level,
          up.head_level,
          up.cannon_level,
          up.magnet_level,
          up.speed_level,
          up.bullet_speed_level,
          up.health_level,
          up.current_level,
          u.total_xp,
          COALESCE(u.total_stars, 0) as total_stars,
          COALESCE(u.rebirth_count, 0) as rebirth_count,
          COALESCE(u.current_series, 1) as current_series,
          COALESCE(u.current_skin, 'default') as current_skin,
          COALESCE(u.owned_skins, ARRAY['default']::TEXT[]) as owned_skins,
          up.updated_at
        FROM user_progress up
        JOIN users u ON up.user_id = u.id
        WHERE up.user_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Progress not found' });
      }

      const progress = result.rows[0];

      return {
        shieldLevel: progress.shield_level,
        headLevel: progress.head_level,
        cannonLevel: progress.cannon_level,
        magnetLevel: progress.magnet_level || 0,
        speedLevel: progress.speed_level || 0,
        bulletSpeedLevel: progress.bullet_speed_level || 0,
        healthLevel: progress.health_level || 0,
        currentLevel: progress.current_level,
        totalXp: progress.total_xp || 0,
        totalStars: progress.total_stars || 0,
        rebirthCount: progress.rebirth_count || 0,
        currentSeries: progress.current_series || 1,
        currentSkin: progress.current_skin || 'default',
        ownedSkins: progress.owned_skins || ['default'],
        updatedAt: progress.updated_at
      };
    } catch (error) {
      throw error;
    }
  });

  // Update user progress
  fastify.put('/:id/progress', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { shieldLevel, headLevel, cannonLevel, magnetLevel, speedLevel, bulletSpeedLevel, healthLevel, currentLevel, totalXp, totalStars } = request.body;

    // Check if user is updating their own data
    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      // Update progress
      await query(
        `UPDATE user_progress 
         SET shield_level = $1, 
             head_level = $2, 
             cannon_level = $3,
             magnet_level = $4,
             speed_level = $5,
             bullet_speed_level = $6,
             health_level = $7,
             current_level = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $9`,
        [shieldLevel, headLevel, cannonLevel, magnetLevel || 0, speedLevel || 0, bulletSpeedLevel || 0, healthLevel || 0, currentLevel, id]
      );

      // Update total XP (this will trigger the function to update users table)
      await query(
        'UPDATE user_progress SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [id]
      );

      // Manually update total_xp and total_stars in users table
      await query(
        'UPDATE users SET total_xp = $1, total_stars = $2 WHERE id = $3',
        [totalXp || 0, totalStars || 0, id]
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Get user statistics
  fastify.get('/:id/stats', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await query(
        `SELECT 
          COUNT(*) as total_sessions,
          MAX(score) as best_score,
          MAX(level_reached) as highest_level,
          SUM(xp_earned) as total_xp_earned,
          AVG(score) as avg_score,
          SUM(duration_seconds) as total_play_time
        FROM game_sessions
        WHERE user_id = $1`,
        [id]
      );

      const stats = result.rows[0];

      return {
        totalSessions: parseInt(stats.total_sessions) || 0,
        bestScore: stats.best_score || 0,
        highestLevel: stats.highest_level || 1,
        totalXpEarned: parseInt(stats.total_xp_earned) || 0,
        avgScore: parseFloat(stats.avg_score) || 0,
        totalPlayTime: parseInt(stats.total_play_time) || 0
      };
    } catch (error) {
      throw error;
    }
  });

  // === SKINS ENDPOINTS ===
  
  // Get user skins
  fastify.get('/:id/skins', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      const result = await query(
        `SELECT current_skin, owned_skins FROM users WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        currentSkin: result.rows[0].current_skin || 'default',
        ownedSkins: result.rows[0].owned_skins || ['default']
      };
    } catch (error) {
      throw error;
    }
  });

  // Buy a skin
  fastify.post('/:id/skins/buy', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { skinId } = request.body;

    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      // Get skin price from shop_upgrades (usando upgrade_type)
      const skinResult = await query(
        `SELECT stars_cost FROM shop_upgrades WHERE upgrade_type = $1 AND level = 1`,
        [skinId]
      );

      if (skinResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Skin not found' });
      }

      const skinCost = skinResult.rows[0].stars_cost;

      // Get user stars and owned skins
      const userResult = await query(
        `SELECT total_stars, owned_skins FROM users WHERE id = $1`,
        [id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const userStars = userResult.rows[0].total_stars || 0;
      const ownedSkins = userResult.rows[0].owned_skins || ['default'];

      // Check if already owns this skin
      const skinName = skinId.replace('skin_', '');
      if (ownedSkins.includes(skinName)) {
        return reply.code(400).send({ error: 'Ya tienes este skin' });
      }

      // Check if has enough stars
      if (userStars < skinCost) {
        return reply.code(400).send({ error: 'No tienes suficientes estrellas' });
      }

      // Buy the skin
      await query(
        `UPDATE users 
         SET total_stars = total_stars - $1,
             owned_skins = array_append(owned_skins, $2)
         WHERE id = $3`,
        [skinCost, skinName, id]
      );

      return { 
        success: true, 
        message: 'Skin comprado',
        skinId: skinName,
        newStars: userStars - skinCost
      };
    } catch (error) {
      throw error;
    }
  });

  // Equip a skin
  fastify.post('/:id/skins/equip', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { skinId } = request.body;

    if (parseInt(id) !== request.user.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    try {
      // Get user owned skins
      const userResult = await query(
        `SELECT owned_skins FROM users WHERE id = $1`,
        [id]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const ownedSkins = userResult.rows[0].owned_skins || ['default'];

      // Check if owns this skin
      if (!ownedSkins.includes(skinId)) {
        return reply.code(400).send({ error: 'No tienes este skin' });
      }

      // Equip the skin
      await query(
        `UPDATE users SET current_skin = $1 WHERE id = $2`,
        [skinId, id]
      );

      return { 
        success: true, 
        message: 'Skin equipado',
        currentSkin: skinId
      };
    } catch (error) {
      throw error;
    }
  });
}
