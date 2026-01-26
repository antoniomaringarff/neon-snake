// Migration 024: Add chat messages table

export const up = async (pool) => {
  await pool.query(`
    -- Table: chat_messages
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Index for faster queries (get recent messages)
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

    -- Index for user lookups
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
  `);
  
  console.log('✅ Migration 024_add_chat completed');
};

export const down = async (pool) => {
  await pool.query(`
    DROP INDEX IF EXISTS idx_chat_messages_user_id;
    DROP INDEX IF EXISTS idx_chat_messages_created_at;
    DROP TABLE IF EXISTS chat_messages;
  `);
  
  console.log('✅ Migration 024_add_chat rolled back');
};
