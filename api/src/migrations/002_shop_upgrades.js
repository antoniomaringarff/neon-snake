export const up = async (pool) => {
  await pool.query(`
    -- Table: shop_upgrades
    CREATE TABLE IF NOT EXISTS shop_upgrades (
      id SERIAL PRIMARY KEY,
      upgrade_type VARCHAR(50) NOT NULL,
      level INTEGER NOT NULL,
      xp_cost INTEGER DEFAULT 0,
      stars_cost INTEGER DEFAULT 0,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(upgrade_type, level)
    );

    -- Index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_shop_upgrades_type_level ON shop_upgrades(upgrade_type, level);

    -- Insert default shop configurations
    INSERT INTO shop_upgrades (upgrade_type, level, xp_cost, stars_cost, description) VALUES
      -- Escudo
      ('shield', 1, 0, 5, 'Escudo en la cabeza'),
      ('shield', 2, 0, 5, 'Escudo atrás y adelante'),
      ('shield', 3, 0, 5, 'Escudo todo el cuerpo'),
      ('shield', 4, 0, 10, 'Protección x 2 todo el cuerpo'),
      ('shield', 5, 0, 10, 'Protección x 3 todo el cuerpo'),
      
      -- Imán XP
      ('magnet', 1, 0, 5, 'Mayor recolección en una área en un 10% extra'),
      ('magnet', 2, 0, 5, 'Mayor recolección en una área en un 20% extra'),
      ('magnet', 3, 0, 5, 'Mayor recolección en una área en un 30% extra'),
      ('magnet', 4, 0, 10, 'Mayor recolección en una área en un 40% extra'),
      ('magnet', 5, 0, 10, 'Mayor recolección en una área en un 50% extra'),
      
      -- Cañón
      ('cannon', 1, 250, 10, 'Cañón en la cabeza que tira de a 1 bala. Un disparo x segundo'),
      ('cannon', 2, 500, 10, 'Doble Cañón en la cabeza que tira de a 2 balas en total. Una bala por cañón. Un disparo x segundo'),
      ('cannon', 3, 750, 10, 'Doble Cañón en la cabeza que tira de a 2 balas en total. Se suma un cañon en la cola. Una bala por cañón. Un disparo x segundo'),
      ('cannon', 4, 750, 10, 'Doble Cañón en la cabeza que tira de a 2 balas en total. Se suma un cañon doble en la cola. Una bala por cañón. Un disparo x segundo'),
      ('cannon', 5, 1000, 10, 'Lo mismo que el anterior, se aceleran los disparos de uno x segundo a dos por segundo'),
      
      -- Velocidad
      ('speed', 1, 100, 0, 'Extra velocidad x 10%'),
      ('speed', 2, 200, 0, 'Extra velocidad x 20%'),
      ('speed', 3, 300, 0, 'Extra velocidad x 30%'),
      ('speed', 4, 400, 0, 'Extra velocidad x 40%'),
      ('speed', 5, 500, 0, 'Extra velocidad x 50%'),
      ('speed', 6, 600, 0, 'Extra velocidad x 60%'),
      ('speed', 7, 700, 0, 'Extra velocidad x 70%'),
      ('speed', 8, 800, 0, 'Extra velocidad x 80%'),
      ('speed', 9, 900, 0, 'Extra velocidad x 90%'),
      ('speed', 10, 1000, 0, 'Extra velocidad x 100%')
    ON CONFLICT (upgrade_type, level) DO NOTHING;
  `);

  console.log('✅ Migration 002_shop_upgrades completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP TABLE IF EXISTS shop_upgrades CASCADE;
  `);

  console.log('✅ Migration 002_shop_upgrades rolled back');
};

