// Migration 027: Update XP points and enemy count for all levels
export async function up(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update each level with new XP points and enemy count
    // Format: [level_number, xp_points, enemy_count]
    const levelUpdates = [
      [1, 2000, 15],
      [2, 2200, 15],
      [3, 2420, 20],
      [4, 2662, 25],
      [5, 2928, 30],
      [6, 3221, 35],
      [7, 3543, 40],
      [8, 3897, 45],
      [9, 4287, 50],
      [10, 4716, 10], // Nota: el usuario puso "1" pero asumo que es nivel 10
      [11, 5187, 60],
      [12, 5706, 65],
      [13, 6277, 70],
      [14, 6905, 75],
      [15, 7595, 80],
      [16, 8354, 85],
      [17, 9190, 90],
      [18, 10109, 95],
      [19, 11120, 100],
      [20, 12232, 105],
      [21, 13455, 110],
      [22, 14800, 115],
      [23, 16281, 120],
      [24, 17909, 125],
      [25, 19699, 150]
    ];
    
    for (const [levelNumber, xpPoints, enemyCount] of levelUpdates) {
      await client.query(`
        UPDATE game_levels
        SET xp_points = $1,
            enemy_count = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE level_number = $3
      `, [xpPoints, enemyCount, levelNumber]);
    }
    
    await client.query('COMMIT');
    console.log('✅ Migration 027: Level XP and enemy counts updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool) {
  // This migration updates level values, down would need to restore previous values
  // For safety, we'll just log a warning
  console.log('⚠️ Migration 027 down: Manual restoration of previous level XP and enemy count values required');
}
