// WebSocket server para arena multijugador
import { query } from '../config/database.js';

// Estado global de la arena
const arenaState = {
  players: new Map(), // socketId -> PlayerState
  connections: new Map(), // socketId -> WebSocket connection
  lastUpdate: Date.now()
};

// Estructura de PlayerState
// {
//   socketId: string,
//   userId: number,
//   username: string,
//   x: number,
//   y: number,
//   direction: { x: number, y: number },
//   segments: Array<{x: number, y: number}>,
//   score: number,
//   kills: number,
//   lastUpdate: number
// }

export function setupArenaWebSocket(fastify) {
  fastify.register(async function (fastify) {
    fastify.get('/arena', { websocket: true }, (connection, req) => {
      const socketId = req.socket.remoteAddress + ':' + Date.now();
      let playerState = null;
      let userId = null;
      let username = null;
      let currentArenaSessionId = null;

      connection.socket.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'join_arena':
              // Autenticación: verificar token JWT
              if (!data.token) {
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Token required'
                }));
                return;
              }

              try {
                // Verificar token JWT usando el decorator de fastify
                const decoded = await fastify.jwt.verify(data.token);
                userId = decoded.id;
                username = decoded.username || data.username;

                // IMPORTANTE: Verificar si este usuario ya tiene una conexión activa y limpiarla
                let oldSocketId = null;
                arenaState.players.forEach((player, sid) => {
                  if (player.userId === userId && sid !== socketId) {
                    oldSocketId = sid;
                  }
                });
                
                if (oldSocketId) {
                  console.log(`[Arena] User ${username} (${userId}) already connected with socketId ${oldSocketId}, removing old connection`);
                  arenaState.players.delete(oldSocketId);
                  const oldSocket = arenaState.connections.get(oldSocketId);
                  if (oldSocket && oldSocket.readyState === 1) {
                    oldSocket.close();
                  }
                  arenaState.connections.delete(oldSocketId);
                }

                // Crear estado inicial del jugador
                const hue = Math.floor(Math.random() * 360); // Color único para cada jugador
                playerState = {
                  socketId: socketId,
                  userId: userId,
                  username: username,
                  x: data.x || 0, // Posición enviada por el cliente
                  y: data.y || 0,
                  direction: data.direction || { x: 1, y: 0 },
                  segments: data.segments || [{ x: data.x || 0, y: data.y || 0 }],
                  score: 0,
                  kills: 0,
                  hue: hue, // Color único
                  skin: data.skin || 'default', // Skin del jugador
                  lastUpdate: Date.now()
                };

                arenaState.players.set(socketId, playerState);
                arenaState.connections.set(socketId, connection.socket);

                // Enviar estado inicial completo (incluyendo a sí mismo)
                const allPlayers = Array.from(arenaState.players.values()).map(p => ({
                  userId: p.userId,
                  username: p.username,
                  x: p.x,
                  y: p.y,
                  direction: p.direction,
                  segments: p.segments,
                  score: p.score,
                  kills: p.kills,
                  hue: p.hue,
                  skin: p.skin,
                  speed: p.speed
                }));
                
                console.log(`[Arena] Sending arena_state to ${username} with ${allPlayers.length} players:`, 
                  allPlayers.map(p => `${p.username}(${p.userId})`).join(', '));
                
                connection.socket.send(JSON.stringify({
                  type: 'arena_state',
                  players: allPlayers
                }));

                // Notificar a otros jugadores que hay un nuevo jugador
                const joinMessage = {
                  type: 'player_joined',
                  player: {
                    userId: playerState.userId,
                    username: playerState.username,
                    x: playerState.x,
                    y: playerState.y,
                    direction: playerState.direction,
                    segments: playerState.segments,
                    hue: playerState.hue,
                    skin: playerState.skin,
                    speed: playerState.speed
                  }
                };
                
                const otherConnections = arenaState.connections.size - 1;
                console.log(`[Arena] Broadcasting player_joined for ${username} to ${otherConnections} other players`);
                broadcastToOthers(socketId, joinMessage);

                console.log(`[Arena] ${username} (${userId}) joined successfully. Total players: ${arenaState.players.size}`);
              } catch (error) {
                connection.socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Invalid token'
                }));
              }
              break;

            case 'player_update':
              if (!playerState) return;

              // Actualizar estado del jugador
              playerState.x = data.x;
              playerState.y = data.y;
              playerState.direction = data.direction;
              playerState.segments = data.segments;
              playerState.score = data.score || playerState.score;
              playerState.speed = data.speed || 2.5; // Guardar velocidad
              playerState.skin = data.skin || playerState.skin || 'default'; // Actualizar skin
              playerState.lastUpdate = Date.now();

              // Broadcast a otros jugadores (sin incluir al emisor)
              broadcastToOthers(socketId, {
                type: 'players_update',
                players: [{
                  userId: playerState.userId,
                  username: playerState.username,
                  x: playerState.x,
                  y: playerState.y,
                  direction: playerState.direction,
                  segments: playerState.segments,
                  score: playerState.score,
                  kills: playerState.kills,
                  hue: playerState.hue,
                  speed: playerState.speed,
                  skin: playerState.skin
                }]
              });
              break;

            case 'player_shoot':
              if (!playerState) return;

              // Broadcast disparo a todos los jugadores
              broadcastToAll({
                type: 'player_shoot',
                shooterId: playerState.userId,
                shooterUsername: playerState.username,
                bullet: data.bullet
              });
              break;

            case 'player_killed':
              if (!playerState || !data.victimUserId || !data.killMethod) return;

              // Registrar kill en la base de datos
              try {
                if (currentArenaSessionId && data.victimUserId !== playerState.userId) {
                  await query(
                    `INSERT INTO arena_kills (arena_session_id, killer_user_id, victim_user_id, kill_method, killer_xp_at_death, victim_xp_at_death)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      currentArenaSessionId,
                      playerState.userId,
                      data.victimUserId,
                      data.killMethod,
                      playerState.score,
                      data.victimXpAtDeath || 0
                    ]
                  );

                  playerState.kills = (playerState.kills || 0) + 1;
                }
              } catch (error) {
                console.error('Error registering kill:', error);
              }

              // Broadcast evento de muerte
              broadcastToAll({
                type: 'player_killed',
                killerId: playerState.userId,
                killerUsername: playerState.username,
                victimId: data.victimUserId,
                victimUsername: data.victimUsername,
                killMethod: data.killMethod
              });
              break;

            case 'bullet_hit':
              // Cuando una bala del jugador impacta a otro jugador
              if (!playerState || !data.targetId) return;
              
              // Buscar al jugador objetivo
              let targetPlayer = null;
              arenaState.players.forEach(p => {
                if (p.userId === data.targetId) {
                  targetPlayer = p;
                }
              });
              
              if (targetPlayer) {
                // Notificar al jugador objetivo que recibió un impacto
                const targetSocket = Array.from(arenaState.connections.entries())
                  .find(([id, _]) => arenaState.players.get(id)?.userId === data.targetId)?.[1];
                
                if (targetSocket && targetSocket.readyState === 1) {
                  targetSocket.send(JSON.stringify({
                    type: 'bullet_received',
                    shooterId: playerState.userId,
                    shooterUsername: playerState.username,
                    hitType: data.hitType,
                    damage: data.damage
                  }));
                }
              }
              break;

            case 'player_kill':
              // Cuando un jugador es matado por otro
              if (!playerState || !data.victimId) return;
              
              // Incrementar kills del killer
              let killerPlayer = null;
              arenaState.players.forEach(p => {
                if (p.userId === data.killerId) {
                  killerPlayer = p;
                  p.kills = (p.kills || 0) + 1;
                }
              });
              
              // Buscar nombre del victim
              let victimName = 'Desconocido';
              arenaState.players.forEach(p => {
                if (p.userId === data.victimId) {
                  victimName = p.username;
                }
              });
              
              // Registrar kill en la base de datos
              try {
                if (currentArenaSessionId && data.killerId && data.victimId) {
                  await query(
                    `INSERT INTO arena_kills (arena_session_id, killer_user_id, victim_user_id, kill_method)
                     VALUES ($1, $2, $3, $4)`,
                    [currentArenaSessionId, data.killerId, data.victimId, data.killMethod || 'unknown']
                  );
                }
              } catch (error) {
                console.error('Error registering kill:', error);
              }
              
              // Broadcast evento de muerte a todos
              broadcastToAll({
                type: 'player_killed',
                killerId: data.killerId,
                killerUsername: killerPlayer?.username || 'Desconocido',
                victimId: data.victimId,
                victimUsername: victimName,
                killMethod: data.killMethod
              });
              
              console.log(`[Arena] ${killerPlayer?.username || 'Unknown'} killed ${victimName} via ${data.killMethod}`);
              break;

            case 'player_death':
              if (!playerState) return;

              const sessionXP = data.xp || playerState.score || 0;
              const killCount = data.kills || playerState.kills || 0;
              const xpReward = data.xpReward || Math.floor(sessionXP * 0.1);
              const starsFromKills = data.starsFromKills || killCount * 5;

              // Guardar sesión en la base de datos
              try {
                // Obtener arena config activa
                const configResult = await query(
                  `SELECT id FROM arena_configs WHERE is_active = true LIMIT 1`
                );

                if (configResult.rows.length > 0) {
                  const arenaConfigId = configResult.rows[0].id;
                  const durationSeconds = data.duration || 0;

                  const sessionResult = await query(
                    `INSERT INTO arena_sessions (user_id, arena_config_id, xp_earned, kills_count, deaths_count, duration_seconds)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [
                      userId,
                      arenaConfigId,
                      sessionXP,
                      killCount,
                      1,
                      durationSeconds
                    ]
                  );

                  currentArenaSessionId = sessionResult.rows[0].id;
                  // El leaderboard se actualiza automáticamente via trigger en la DB
                }

                // GUARDAR RECOMPENSAS: Actualizar total_xp y total_stars del usuario
                if (xpReward > 0 || starsFromKills > 0) {
                  await query(
                    `UPDATE users 
                     SET total_xp = COALESCE(total_xp, 0) + $1,
                         total_stars = COALESCE(total_stars, 0) + $2,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [xpReward, starsFromKills, userId]
                  );
                  console.log(`[Arena] Rewards saved for ${username}: +${xpReward} XP, +${starsFromKills} ⭐`);
                }
              } catch (error) {
                console.error('Error saving arena session:', error);
              }

              // Remover jugador del estado
              arenaState.players.delete(socketId);
              arenaState.connections.delete(socketId);

              // Notificar a otros jugadores
              broadcastToOthers(socketId, {
                type: 'player_left',
                userId: playerState.userId,
                username: playerState.username
              });

              console.log(`[Arena] ${username} (${userId}) died with ${sessionXP} XP and ${killCount} kills. Rewards: +${xpReward} XP, +${starsFromKills} ⭐`);
              break;
          }
        } catch (error) {
          console.error('WebSocket error:', error);
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Server error'
          }));
        }
      });

      connection.socket.on('close', () => {
        if (playerState) {
          arenaState.players.delete(socketId);
          arenaState.connections.delete(socketId);
          broadcastToOthers(socketId, {
            type: 'player_left',
            userId: playerState.userId,
            username: playerState.username
          });
          console.log(`[Arena] ${username || 'Unknown'} disconnected`);
        }
      });

      // Función helper para broadcast a otros jugadores
      function broadcastToOthers(excludeSocketId, message) {
        const messageStr = JSON.stringify(message);
        arenaState.connections.forEach((client, id) => {
          if (id !== excludeSocketId && client.readyState === 1) {
            try {
              client.send(messageStr);
            } catch (error) {
              console.error('Error broadcasting to client:', error);
            }
          }
        });
      }

      // Función helper para broadcast a todos
      function broadcastToAll(message) {
        const messageStr = JSON.stringify(message);
        arenaState.connections.forEach((client) => {
          if (client.readyState === 1) {
            try {
              client.send(messageStr);
            } catch (error) {
              console.error('Error broadcasting to client:', error);
            }
          }
        });
      }
    });
  });
}

// Función para obtener estado actual de la arena
export function getArenaState() {
  return {
    players: Array.from(arenaState.players.values()),
    playerCount: arenaState.players.size,
    lastUpdate: arenaState.lastUpdate
  };
}
