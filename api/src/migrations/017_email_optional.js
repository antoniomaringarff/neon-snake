export const up = async (pool) => {
  await pool.query(`
    -- Hacer el email opcional (puede ser NULL)
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    
    -- Quitar el constraint único del email para permitir múltiples NULLs
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
    
    -- Crear un índice único parcial que solo aplique cuando email NO es NULL
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique 
    ON users (email) 
    WHERE email IS NOT NULL;
  `);
  
  console.log('✅ Migration 017_email_optional completed');
};

export const down = async (pool) => {
  await pool.query(`
    -- Volver a hacer el email obligatorio
    -- Primero actualizar los NULLs con un valor placeholder
    UPDATE users SET email = username || '@placeholder.local' WHERE email IS NULL;
    
    -- Quitar el índice parcial
    DROP INDEX IF EXISTS users_email_unique;
    
    -- Volver a crear el constraint único normal
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    
    -- Hacer el email NOT NULL de nuevo
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  `);
  
  console.log('✅ Migration 017_email_optional rolled back');
};
