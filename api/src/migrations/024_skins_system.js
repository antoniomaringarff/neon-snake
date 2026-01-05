// Migración para sistema de skins
import { query } from '../config/database.js';

export async function up() {
  // Agregar columna skin a usuarios
  await query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS current_skin VARCHAR(50) DEFAULT 'default'
  `);

  // Agregar columna owned_skins para guardar los skins comprados
  await query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS owned_skins TEXT[] DEFAULT ARRAY['default']::TEXT[]
  `);

  // Agregar los skins a la tienda de upgrades (usando estructura existente)
  await query(`
    INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description)
    VALUES 
      ('skin_dragon', 1, 0, 50, '🐉 Skin Dragón de Fuego - Escamas con gradiente naranja/rojo y efecto de fuego'),
      ('skin_rainbow', 1, 0, 100, '🌈 Skin Serpiente Arcoíris - Colores del arcoíris animados que fluyen por el cuerpo'),
      ('skin_cyber', 1, 0, 200, '⚡ Skin Cyber Serpiente - Estilo Tron/Matrix con líneas de neón brillantes')
    ON CONFLICT (upgrade_type, level) DO UPDATE SET
      description = EXCLUDED.description,
      stars_cost = EXCLUDED.stars_cost
  `);

  console.log('✅ Skins system migration completed');
}

export async function down() {
  await query(`ALTER TABLE users DROP COLUMN IF EXISTS current_skin`);
  await query(`ALTER TABLE users DROP COLUMN IF EXISTS owned_skins`);
  await query(`DELETE FROM shop_upgrades WHERE upgrade_type IN ('skin_dragon', 'skin_rainbow', 'skin_cyber')`);
}
