// Migration 026: Add more arena config fields
export const up = async (client) => {
  // Agregar nuevas columnas para configuración de arena
  await client.query(`
    ALTER TABLE arena_configs
    ADD COLUMN IF NOT EXISTS xp_density NUMERIC(5,2) DEFAULT 15,
    ADD COLUMN IF NOT EXISTS stars_density NUMERIC(5,2) DEFAULT 2,
    ADD COLUMN IF NOT EXISTS enemy_speed NUMERIC(4,2) DEFAULT 2.5,
    ADD COLUMN IF NOT EXISTS enemy_shoot_cooldown INTEGER DEFAULT 2000,
    ADD COLUMN IF NOT EXISTS star_lifetime INTEGER DEFAULT 60,
    ADD COLUMN IF NOT EXISTS saws_density NUMERIC(5,3) DEFAULT 0.08,
    ADD COLUMN IF NOT EXISTS cannons_density NUMERIC(5,3) DEFAULT 0.08,
    ADD COLUMN IF NOT EXISTS resentful_density NUMERIC(5,3) DEFAULT 0.01,
    ADD COLUMN IF NOT EXISTS health_boxes_density NUMERIC(5,3) DEFAULT 0.15
  `);
  
  // Actualizar la configuración activa con valores razonables
  await client.query(`
    UPDATE arena_configs
    SET 
      map_size = 5,
      xp_density = 15,
      stars_density = 2,
      enemy_speed = 2.5,
      enemy_count = 30,
      killer_saw_count = 2,
      floating_cannon_count = 2,
      resentful_snake_count = 1,
      health_box_count = 4,
      star_lifetime = 60,
      saws_density = 0.08,
      cannons_density = 0.08,
      resentful_density = 0.01,
      health_boxes_density = 0.15
    WHERE is_active = true
  `);
  
  console.log('✅ Arena config improvements applied');
};

export const down = async (client) => {
  await client.query(`
    ALTER TABLE arena_configs
    DROP COLUMN IF EXISTS xp_density,
    DROP COLUMN IF EXISTS stars_density,
    DROP COLUMN IF EXISTS enemy_speed,
    DROP COLUMN IF EXISTS enemy_shoot_cooldown,
    DROP COLUMN IF EXISTS star_lifetime,
    DROP COLUMN IF EXISTS saws_density,
    DROP COLUMN IF EXISTS cannons_density,
    DROP COLUMN IF EXISTS resentful_density,
    DROP COLUMN IF EXISTS health_boxes_density
  `);
  
  console.log('✅ Arena config improvements reverted');
};
