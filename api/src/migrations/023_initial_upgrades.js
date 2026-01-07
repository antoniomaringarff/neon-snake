// Migration 023: Give all users initial upgrade levels (1 of everything)
// - New users start with level 1 in all upgrades (like a free rebirth)
// - Existing users with 0 in any upgrade get upgraded to 1

export const up = async (pool) => {
  await pool.query(`
    -- Update existing users who have 0 in any upgrade to have 1 instead
    UPDATE user_progress
    SET 
      shield_level = GREATEST(shield_level, 1),
      cannon_level = GREATEST(cannon_level, 1),
      magnet_level = GREATEST(magnet_level, 1),
      speed_level = GREATEST(speed_level, 1),
      bullet_speed_level = GREATEST(bullet_speed_level, 1),
      health_level = GREATEST(health_level, 1),
      head_level = GREATEST(head_level, 2),
      updated_at = CURRENT_TIMESTAMP
    WHERE shield_level = 0 
       OR cannon_level = 0 
       OR magnet_level = 0 
       OR speed_level = 0 
       OR bullet_speed_level = 0 
       OR health_level = 0
       OR head_level < 2;

    -- Update column defaults so new records start with 1
    ALTER TABLE user_progress 
      ALTER COLUMN shield_level SET DEFAULT 1,
      ALTER COLUMN cannon_level SET DEFAULT 1,
      ALTER COLUMN magnet_level SET DEFAULT 1,
      ALTER COLUMN speed_level SET DEFAULT 1,
      ALTER COLUMN bullet_speed_level SET DEFAULT 1,
      ALTER COLUMN health_level SET DEFAULT 1,
      ALTER COLUMN head_level SET DEFAULT 2;

    -- Recreate the trigger function to use the new defaults
    CREATE OR REPLACE FUNCTION create_user_progress()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO user_progress (
        user_id, 
        shield_level, 
        cannon_level, 
        magnet_level, 
        speed_level, 
        bullet_speed_level, 
        health_level,
        head_level,
        current_level
      ) VALUES (
        NEW.id,
        1,  -- shield starts at 1
        1,  -- cannon starts at 1
        1,  -- magnet starts at 1
        1,  -- speed starts at 1
        1,  -- bullet_speed starts at 1
        1,  -- health starts at 1
        2,  -- head starts at 2 (1 is min but we give +1)
        1   -- current_level starts at 1
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Migration 023_initial_upgrades completed - All users now start with level 1 upgrades');
};

export const down = async (pool) => {
  await pool.query(`
    -- Revert column defaults to 0
    ALTER TABLE user_progress 
      ALTER COLUMN shield_level SET DEFAULT 0,
      ALTER COLUMN cannon_level SET DEFAULT 0,
      ALTER COLUMN magnet_level SET DEFAULT 0,
      ALTER COLUMN speed_level SET DEFAULT 0,
      ALTER COLUMN bullet_speed_level SET DEFAULT 0,
      ALTER COLUMN health_level SET DEFAULT 0,
      ALTER COLUMN head_level SET DEFAULT 1;

    -- Recreate the original trigger function
    CREATE OR REPLACE FUNCTION create_user_progress()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO user_progress (user_id) VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Migration 023_initial_upgrades rolled back');
};
