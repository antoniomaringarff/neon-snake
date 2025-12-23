// Migration: This was intended to fix magnet constraint but was empty when executed
// The actual fix is in migration 011
export async function up(pool) {
  console.log('⏭️ Migration 010 was already executed (empty), fix is in 011');
}

export async function down(pool) {
  console.log('⏭️ Migration 010 down (no-op)');
}

