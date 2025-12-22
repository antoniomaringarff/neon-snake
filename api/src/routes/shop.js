import { query } from '../config/database.js';

export default async function shopRoutes(fastify, options) {
  // Get all shop upgrades configurations
  fastify.get('/upgrades', async (request, reply) => {
    try {
      const result = await query(
        `SELECT 
          upgrade_type,
          level,
          xp_cost,
          stars_cost,
          description
        FROM shop_upgrades
        ORDER BY upgrade_type, level`
      );

      // Organize by upgrade type
      const upgrades = {};
      result.rows.forEach(row => {
        if (!upgrades[row.upgrade_type]) {
          upgrades[row.upgrade_type] = [];
        }
        upgrades[row.upgrade_type].push({
          level: row.level,
          xpCost: row.xp_cost,
          starsCost: row.stars_cost,
          description: row.description
        });
      });

      return upgrades;
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Get upgrades for a specific type
  fastify.get('/upgrades/:type', async (request, reply) => {
    const { type } = request.params;

    try {
      const result = await query(
        `SELECT 
          level,
          xp_cost,
          stars_cost,
          description
        FROM shop_upgrades
        WHERE upgrade_type = $1
        ORDER BY level`,
        [type]
      );

      return result.rows.map(row => ({
        level: row.level,
        xpCost: row.xp_cost,
        starsCost: row.stars_cost,
        description: row.description
      }));
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Update a specific upgrade configuration (admin only - could add auth later)
  fastify.put('/upgrades/:type/:level', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { type, level } = request.params;
    const { xpCost, starsCost, description } = request.body;

    try {
      const result = await query(
        `UPDATE shop_upgrades
         SET xp_cost = $1,
             stars_cost = $2,
             description = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE upgrade_type = $4 AND level = $5
         RETURNING *`,
        [xpCost, starsCost, description, type, level]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Upgrade not found' });
      }

      return {
        upgradeType: result.rows[0].upgrade_type,
        level: result.rows[0].level,
        xpCost: result.rows[0].xp_cost,
        starsCost: result.rows[0].stars_cost,
        description: result.rows[0].description
      };
    } catch (error) {
      fastify.log.error(error);
      throw error;
    }
  });

  // Create a new upgrade configuration
  fastify.post('/upgrades', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { upgradeType, level, xpCost, starsCost, description } = request.body;

    try {
      const result = await query(
        `INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [upgradeType, level, xpCost || 0, starsCost || 0, description]
      );

      return {
        upgradeType: result.rows[0].upgrade_type,
        level: result.rows[0].level,
        xpCost: result.rows[0].xp_cost,
        starsCost: result.rows[0].stars_cost,
        description: result.rows[0].description
      };
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return reply.code(409).send({ error: 'Upgrade already exists' });
      }
      fastify.log.error(error);
      throw error;
    }
  });
}

