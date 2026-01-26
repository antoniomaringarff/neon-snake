// WebSocket server para arena multijugador
import { query } from '../config/database.js';

// Constantes del mapa
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const BORDER_WIDTH = 40;

// Configuración dinámica (se carga de la DB)
let arenaConfig = {
  mapSize: 5,
  xpDensity: 15,
  starsDensity: 2,
  enemyCount: 30,
  enemySpeed: 2.5,
  enemyShootPercentage: 50,
  enemyShieldPercentage: 50,
  enemyShootCooldown: 2000,
  killerSawCount: 2,
  floatingCannonCount: 2,
  resentfulSnakeCount: 1,
  healthBoxCount: 4,
  starLifetime: 60, // segundos
  sawsDensity: 0.08,
  cannonsDensity: 0.08,
  resentfulDensity: 0.01,
  healthBoxesDensity: 0.15
};

// Estado global de la arena (UN SOLO ESCENARIO COMPARTIDO)
const arenaState = {
  players: new Map(), // socketId -> PlayerState
  connections: new Map(), // socketId -> WebSocket connection
  
  // Estado del mapa compartido
  mapInitialized: false,
  food: [], // Puntos de XP
  stars: [], // Estrellas
  enemies: [], // Enemigos normales
  killerSaws: [], // Sierras
  floatingCannons: [], // Cañones
  resentfulSnakes: [], // Víboras resentidas
  healthBoxes: [], // Cajas de vida
  
  // Configuración dinámica
  worldWidth: CANVAS_WIDTH * 5,
  worldHeight: CANVAS_HEIGHT * 5,
  
  lastUpdate: Date.now(),
  lastMapBroadcast: 0,
  lastStarCleanup: Date.now()
};

// IDs únicos para entidades
let nextEntityId = 1;
function generateId() {
  return nextEntityId++;
}

// === FUNCIONES DE GENERACIÓN DE ENTIDADES ===

function randomPosition() {
  const margin = BORDER_WIDTH + 50;
  return {
    x: margin + Math.random() * (arenaState.worldWidth - margin * 2),
    y: margin + Math.random() * (arenaState.worldHeight - margin * 2)
  };
}

function createFood() {
  const pos = randomPosition();
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    size: 6 + Math.random() * 8,
    value: Math.random() < 0.3 ? 2 : 1,
    hue: Math.floor(Math.random() * 360)
  };
}

function createStar() {
  const pos = randomPosition();
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    size: 10 + Math.random() * 5,
    rotation: Math.random() * Math.PI * 2,
    createdAt: Date.now() // TTL para expirar
  };
}

// Cargar configuración de arena desde la DB
async function loadArenaConfig() {
  try {
    const result = await query(
      `SELECT * FROM arena_configs WHERE is_active = true LIMIT 1`
    );
    
    if (result.rows.length > 0) {
      const config = result.rows[0];
      arenaConfig = {
        mapSize: config.map_size || 5,
        xpDensity: parseFloat(config.xp_density) || 15,
        starsDensity: parseFloat(config.stars_density) || 2,
        enemyCount: config.enemy_count || 30,
        enemySpeed: parseFloat(config.enemy_speed) || 2.5,
        enemyShootPercentage: config.enemy_shoot_percentage || 50,
        enemyShieldPercentage: config.enemy_shield_percentage || 50,
        enemyShootCooldown: config.enemy_shoot_cooldown || 2000,
        killerSawCount: config.killer_saw_count || 2,
        floatingCannonCount: config.floating_cannon_count || 2,
        resentfulSnakeCount: config.resentful_snake_count || 1,
        healthBoxCount: config.health_box_count || 4,
        starLifetime: config.star_lifetime || 60,
        sawsDensity: parseFloat(config.saws_density) || 0.08,
        cannonsDensity: parseFloat(config.cannons_density) || 0.08,
        resentfulDensity: parseFloat(config.resentful_density) || 0.01,
        healthBoxesDensity: parseFloat(config.health_boxes_density) || 0.15
      };
      console.log('[Arena] Config loaded from DB:', arenaConfig);
    } else {
      console.log('[Arena] No active config in DB, using defaults');
    }
    
    // Actualizar dimensiones del mundo
    arenaState.worldWidth = CANVAS_WIDTH * arenaConfig.mapSize;
    arenaState.worldHeight = CANVAS_HEIGHT * arenaConfig.mapSize;
    
  } catch (error) {
    console.error('[Arena] Error loading config:', error);
  }
}

function createEnemy() {
  const pos = randomPosition();
  const angle = Math.random() * Math.PI * 2;
  const segmentCount = 8 + Math.floor(Math.random() * 7);
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({ 
      x: pos.x - i * 10 * Math.cos(angle), 
      y: pos.y - i * 10 * Math.sin(angle)
    });
  }
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    direction: { x: Math.cos(angle), y: Math.sin(angle) },
    segments,
    hue: Math.floor(Math.random() * 360),
    speed: 1.5 + Math.random() * 1.5,
    turnTimer: 0,
    turnInterval: 60 + Math.random() * 120,
    totalXP: segmentCount * 2,
    starsEaten: Math.random() < 0.3 ? 1 : 0
  };
}

function createKillerSaw() {
  const pos = randomPosition();
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    size: 25 + Math.random() * 15,
    rotation: 0,
    rotationSpeed: 0.05 + Math.random() * 0.05,
    // Movimiento
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2
  };
}

function createFloatingCannon() {
  const pos = randomPosition();
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    size: 20 + Math.random() * 10,
    angle: Math.random() * Math.PI * 2,
    rotationSpeed: 0.01 + Math.random() * 0.02,
    fireRate: 120 + Math.random() * 60,
    fireTimer: 0
  };
}

function createResentfulSnake() {
  const pos = randomPosition();
  const segmentCount = 15 + Math.floor(Math.random() * 10);
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({ x: pos.x - i * 12, y: pos.y });
  }
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    direction: { x: 1, y: 0 },
    segments,
    speed: 2.2 + Math.random() * 0.8,
    health: 3,
    maxHealth: 3,
    hue: 0, // Rojo
    fireRate: 40 + Math.random() * 30,
    fireTimer: 0,
    chaseRange: 1200,
    targetPlayer: null
  };
}

function createHealthBox() {
  const pos = randomPosition();
  return {
    id: generateId(),
    x: pos.x,
    y: pos.y,
    size: 18
  };
}

// === INICIALIZAR MAPA ===
async function initializeMap() {
  if (arenaState.mapInitialized) return;
  
  // Cargar configuración de la DB
  await loadArenaConfig();
  
  const numScreens = arenaConfig.mapSize * arenaConfig.mapSize;
  
  // Calcular cantidades basadas en configuración
  const foodCount = Math.floor(numScreens * arenaConfig.xpDensity);
  const starCount = Math.floor(numScreens * arenaConfig.starsDensity);
  const enemyCount = arenaConfig.enemyCount;
  const sawCount = arenaConfig.killerSawCount;
  const cannonCount = arenaConfig.floatingCannonCount;
  const resentfulCount = arenaConfig.resentfulSnakeCount;
  const healthBoxCount = arenaConfig.healthBoxCount;
  
  console.log(`[Arena Map] Initializing shared map (${arenaConfig.mapSize}x${arenaConfig.mapSize} screens):`);
  console.log(`  - World size: ${arenaState.worldWidth}x${arenaState.worldHeight}px`);
  console.log(`  - Food (XP): ${foodCount}`);
  console.log(`  - Stars: ${starCount}`);
  console.log(`  - Enemies: ${enemyCount}`);
  console.log(`  - Saws: ${sawCount}`);
  console.log(`  - Cannons: ${cannonCount}`);
  console.log(`  - Resentful Snakes: ${resentfulCount}`);
  console.log(`  - Health Boxes: ${healthBoxCount}`);
  console.log(`  - Star lifetime: ${arenaConfig.starLifetime}s`);
  
  // Generar entidades
  arenaState.food = Array.from({ length: foodCount }, () => createFood());
  arenaState.stars = Array.from({ length: starCount }, () => createStar());
  arenaState.enemies = Array.from({ length: enemyCount }, () => createEnemy());
  arenaState.killerSaws = Array.from({ length: sawCount }, () => createKillerSaw());
  arenaState.floatingCannons = Array.from({ length: cannonCount }, () => createFloatingCannon());
  arenaState.resentfulSnakes = Array.from({ length: resentfulCount }, () => createResentfulSnake());
  arenaState.healthBoxes = Array.from({ length: healthBoxCount }, () => createHealthBox());
  
  arenaState.mapInitialized = true;
  console.log(`[Arena Map] Map initialized successfully!`);
}

// === RESPAWN FUNCTIONS ===
function respawnFood() {
  arenaState.food.push(createFood());
}

function respawnStar() {
  arenaState.stars.push(createStar());
}

function respawnEnemy() {
  arenaState.enemies.push(createEnemy());
}

function respawnHealthBox() {
  arenaState.healthBoxes.push(createHealthBox());
}

function respawnResentfulSnake() {
  // Esperar un poco antes de respawnear víboras resentidas
  setTimeout(() => {
    arenaState.resentfulSnakes.push(createResentfulSnake());
    console.log(`[Arena] Resentful snake respawned. Total: ${arenaState.resentfulSnakes.length}`);
  }, 5000);
}

// === GAME LOOP DEL SERVIDOR ===
let gameLoopInterval = null;

function startGameLoop() {
  if (gameLoopInterval) return;
  
  gameLoopInterval = setInterval(() => {
    // Solo procesar si hay jugadores conectados
    if (arenaState.players.size === 0) {
      return; // Pausar procesamiento cuando no hay jugadores
    }
    
    updateServerEntities();
    
    // Limpiar estrellas expiradas cada 5 segundos
    if (Date.now() - arenaState.lastStarCleanup > 5000) {
      cleanupExpiredStars();
      arenaState.lastStarCleanup = Date.now();
    }
    
    // Broadcast estado del mapa cada 100ms
    if (Date.now() - arenaState.lastMapBroadcast > 100) {
      broadcastMapState();
      arenaState.lastMapBroadcast = Date.now();
    }
  }, 50); // 20 updates por segundo
  
  console.log('[Arena] Game loop started');
}

function stopGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    console.log('[Arena] Game loop stopped');
  }
}

// Limpiar estrellas que han expirado (más de starLifetime segundos)
function cleanupExpiredStars() {
  const now = Date.now();
  const lifetimeMs = arenaConfig.starLifetime * 1000;
  const initialCount = arenaState.stars.length;
  
  arenaState.stars = arenaState.stars.filter(star => {
    const age = now - (star.createdAt || now);
    return age < lifetimeMs;
  });
  
  const removed = initialCount - arenaState.stars.length;
  if (removed > 0) {
    console.log(`[Arena] Cleaned up ${removed} expired stars (lifetime: ${arenaConfig.starLifetime}s)`);
  }
}

function updateServerEntities() {
  const delta = 1; // Factor de tiempo normalizado
  
  // Actualizar enemigos
  arenaState.enemies.forEach(enemy => {
    // Movimiento
    enemy.turnTimer++;
    if (enemy.turnTimer >= enemy.turnInterval) {
      enemy.turnTimer = 0;
      const turnAngle = (Math.random() - 0.5) * Math.PI / 2;
      const angle = Math.atan2(enemy.direction.y, enemy.direction.x) + turnAngle;
      enemy.direction = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    
    // Mover cabeza
    enemy.x += enemy.direction.x * enemy.speed * delta;
    enemy.y += enemy.direction.y * enemy.speed * delta;
    
    // Rebotar en bordes
    const margin = BORDER_WIDTH + 20;
    if (enemy.x < margin || enemy.x > arenaState.worldWidth - margin) {
      enemy.direction.x *= -1;
      enemy.x = Math.max(margin, Math.min(arenaState.worldWidth - margin, enemy.x));
    }
    if (enemy.y < margin || enemy.y > arenaState.worldHeight - margin) {
      enemy.direction.y *= -1;
      enemy.y = Math.max(margin, Math.min(arenaState.worldHeight - margin, enemy.y));
    }
    
    // Actualizar segmentos
    if (enemy.segments.length > 0) {
      enemy.segments[0] = { x: enemy.x, y: enemy.y };
      for (let i = 1; i < enemy.segments.length; i++) {
        const prev = enemy.segments[i - 1];
        const curr = enemy.segments[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          const ratio = 10 / dist;
          curr.x = prev.x - dx * ratio;
          curr.y = prev.y - dy * ratio;
        }
      }
    }
  });
  
  // Actualizar sierras
  arenaState.killerSaws.forEach(saw => {
    saw.rotation += saw.rotationSpeed * delta;
    saw.x += saw.vx * delta;
    saw.y += saw.vy * delta;
    
    // Rebotar en bordes
    const margin = BORDER_WIDTH + saw.size;
    if (saw.x < margin || saw.x > arenaState.worldWidth - margin) {
      saw.vx *= -1;
      saw.x = Math.max(margin, Math.min(arenaState.worldWidth - margin, saw.x));
    }
    if (saw.y < margin || saw.y > arenaState.worldHeight - margin) {
      saw.vy *= -1;
      saw.y = Math.max(margin, Math.min(arenaState.worldHeight - margin, saw.y));
    }
  });
  
  // Actualizar cañones (solo rotación)
  arenaState.floatingCannons.forEach(cannon => {
    cannon.angle += cannon.rotationSpeed * delta;
  });
  
  // Actualizar víboras resentidas (perseguir al jugador más cercano)
  arenaState.resentfulSnakes.forEach(snake => {
    // Encontrar jugador más cercano
    let closestPlayer = null;
    let closestDist = snake.chaseRange;
    
    arenaState.players.forEach(player => {
      const dx = player.x - snake.x;
      const dy = player.y - snake.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = player;
      }
    });
    
    if (closestPlayer) {
      // Girar hacia el jugador
      const dx = closestPlayer.x - snake.x;
      const dy = closestPlayer.y - snake.y;
      const targetAngle = Math.atan2(dy, dx);
      const currentAngle = Math.atan2(snake.direction.y, snake.direction.x);
      let angleDiff = targetAngle - currentAngle;
      
      // Normalizar ángulo
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      // Girar gradualmente
      const turnSpeed = 0.05;
      const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnSpeed);
      snake.direction = { x: Math.cos(newAngle), y: Math.sin(newAngle) };
    }
    
    // Mover
    snake.x += snake.direction.x * snake.speed * delta;
    snake.y += snake.direction.y * snake.speed * delta;
    
    // Rebotar en bordes
    const margin = BORDER_WIDTH + 20;
    if (snake.x < margin || snake.x > arenaState.worldWidth - margin) {
      snake.direction.x *= -1;
      snake.x = Math.max(margin, Math.min(arenaState.worldWidth - margin, snake.x));
    }
    if (snake.y < margin || snake.y > arenaState.worldHeight - margin) {
      snake.direction.y *= -1;
      snake.y = Math.max(margin, Math.min(arenaState.worldHeight - margin, snake.y));
    }
    
    // Actualizar segmentos
    if (snake.segments.length > 0) {
      snake.segments[0] = { x: snake.x, y: snake.y };
      for (let i = 1; i < snake.segments.length; i++) {
        const prev = snake.segments[i - 1];
        const curr = snake.segments[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 12) {
          const ratio = 12 / dist;
          curr.x = prev.x - dx * ratio;
          curr.y = prev.y - dy * ratio;
        }
      }
    }
  });
  
  // Actualizar rotación de estrellas (muy lento para evitar temblor)
  arenaState.stars.forEach(star => {
    star.rotation += 0.002 * delta; // Rotación muy suave
  });
}

function broadcastMapState() {
  if (arenaState.connections.size === 0) return;
  
  const message = JSON.stringify({
    type: 'map_state',
    food: arenaState.food,
    stars: arenaState.stars,
    enemies: arenaState.enemies.map(e => ({
      id: e.id,
      x: e.x,
      y: e.y,
      direction: e.direction,
      segments: e.segments,
      hue: e.hue,
      speed: e.speed
    })),
    killerSaws: arenaState.killerSaws,
    floatingCannons: arenaState.floatingCannons,
    resentfulSnakes: arenaState.resentfulSnakes.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      direction: s.direction,
      segments: s.segments,
      speed: s.speed,
      health: s.health,
      maxHealth: s.maxHealth,
      hue: s.hue
    })),
    healthBoxes: arenaState.healthBoxes
  });
  
  arenaState.connections.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        // Ignorar errores de envío
      }
    }
  });
}

export async function setupArenaWebSocket(fastify) {
  // Inicializar el mapa al iniciar el servidor
  await initializeMap();
  startGameLoop();
  
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

                // Crear estado inicial del jugador en posición aleatoria
                const pos = randomPosition();
                const hue = Math.floor(Math.random() * 360);
                playerState = {
                  socketId: socketId,
                  userId: userId,
                  username: username,
                  x: pos.x,
                  y: pos.y,
                  direction: { x: 1, y: 0 },
                  segments: [{ x: pos.x, y: pos.y }],
                  score: 0,
                  kills: 0,
                  hue: hue,
                  skin: data.skin || 'default',
                  currentHealth: data.currentHealth || 2,
                  maxHealth: data.maxHealth || 2,
                  speed: data.speed || 2.5,
                  lastUpdate: Date.now()
                };

                arenaState.players.set(socketId, playerState);
                arenaState.connections.set(socketId, connection.socket);

                // Enviar estado inicial completo
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
                  speed: p.speed,
                  currentHealth: p.currentHealth,
                  maxHealth: p.maxHealth
                }));
                
                console.log(`[Arena] Sending arena_state to ${username} with ${allPlayers.length} players`);
                
                // Enviar estado del jugador + otros jugadores
                connection.socket.send(JSON.stringify({
                  type: 'arena_state',
                  players: allPlayers,
                  spawnPosition: { x: pos.x, y: pos.y },
                  worldWidth: arenaState.worldWidth,
                  worldHeight: arenaState.worldHeight
                }));
                
                // Enviar estado inicial del mapa
                connection.socket.send(JSON.stringify({
                  type: 'map_state',
                  food: arenaState.food,
                  stars: arenaState.stars,
                  enemies: arenaState.enemies.map(e => ({
                    id: e.id,
                    x: e.x,
                    y: e.y,
                    direction: e.direction,
                    segments: e.segments,
                    hue: e.hue,
                    speed: e.speed
                  })),
                  killerSaws: arenaState.killerSaws,
                  floatingCannons: arenaState.floatingCannons,
                  resentfulSnakes: arenaState.resentfulSnakes.map(s => ({
                    id: s.id,
                    x: s.x,
                    y: s.y,
                    direction: s.direction,
                    segments: s.segments,
                    speed: s.speed,
                    health: s.health,
                    maxHealth: s.maxHealth,
                    hue: s.hue
                  })),
                  healthBoxes: arenaState.healthBoxes
                }));

                // Notificar a otros jugadores que hay un nuevo jugador
                broadcastToOthers(socketId, {
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
                    speed: playerState.speed,
                    currentHealth: playerState.currentHealth,
                    maxHealth: playerState.maxHealth
                  }
                });

                console.log(`[Arena] ${username} (${userId}) joined successfully. Total players: ${arenaState.players.size}`);
              } catch (error) {
                console.error('JWT verification error:', error);
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
              playerState.speed = data.speed || playerState.speed;
              playerState.skin = data.skin || playerState.skin;
              playerState.currentHealth = data.currentHealth ?? playerState.currentHealth;
              playerState.maxHealth = data.maxHealth ?? playerState.maxHealth;
              playerState.lastUpdate = Date.now();

              // Broadcast a otros jugadores
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
                  skin: playerState.skin,
                  currentHealth: playerState.currentHealth,
                  maxHealth: playerState.maxHealth
                }]
              });
              break;

            // === EVENTOS DE CONSUMO/DESTRUCCIÓN DE ENTIDADES ===
            
            case 'consume_food':
              // Un jugador comió un punto de XP
              if (!data.foodId) return;
              const foodIndex = arenaState.food.findIndex(f => f.id === data.foodId);
              if (foodIndex >= 0) {
                arenaState.food.splice(foodIndex, 1);
                // Respawnear inmediatamente
                respawnFood();
              }
              break;
              
            case 'consume_star':
              // Un jugador comió una estrella
              if (!data.starId) return;
              const starIndex = arenaState.stars.findIndex(s => s.id === data.starId);
              if (starIndex >= 0) {
                arenaState.stars.splice(starIndex, 1);
                // Respawnear inmediatamente
                respawnStar();
              }
              break;
              
            case 'consume_health_box':
              // Un jugador agarró una caja de vida
              if (!data.healthBoxId) return;
              const hbIndex = arenaState.healthBoxes.findIndex(h => h.id === data.healthBoxId);
              if (hbIndex >= 0) {
                arenaState.healthBoxes.splice(hbIndex, 1);
                // Respawnear inmediatamente
                respawnHealthBox();
              }
              break;
              
            case 'kill_enemy':
              // Un jugador mató a un enemigo
              if (!data.enemyId) return;
              const enemyIndex = arenaState.enemies.findIndex(e => e.id === data.enemyId);
              if (enemyIndex >= 0) {
                arenaState.enemies.splice(enemyIndex, 1);
                // Respawnear inmediatamente
                respawnEnemy();
              }
              break;
              
            case 'kill_resentful':
              // Un jugador mató a una víbora resentida
              if (!data.resentfulId) return;
              const resIndex = arenaState.resentfulSnakes.findIndex(r => r.id === data.resentfulId);
              if (resIndex >= 0) {
                arenaState.resentfulSnakes.splice(resIndex, 1);
                // Respawnear después de un delay
                respawnResentfulSnake();
              }
              break;
              
            case 'damage_resentful':
              // Una víbora resentida recibió daño
              if (!data.resentfulId) return;
              const resSnake = arenaState.resentfulSnakes.find(r => r.id === data.resentfulId);
              if (resSnake) {
                resSnake.health = Math.max(0, resSnake.health - (data.damage || 1));
                if (resSnake.health <= 0) {
                  // Murió, remover y respawnear
                  const idx = arenaState.resentfulSnakes.findIndex(r => r.id === data.resentfulId);
                  if (idx >= 0) {
                    arenaState.resentfulSnakes.splice(idx, 1);
                    respawnResentfulSnake();
                  }
                }
              }
              break;

            case 'player_shoot':
              if (!playerState) return;
              broadcastToAll({
                type: 'player_shoot',
                shooterId: playerState.userId,
                shooterUsername: playerState.username,
                bullet: data.bullet
              });
              break;
            
            case 'player_bullets':
              if (!playerState || !data.bullets || !Array.isArray(data.bullets)) return;
              broadcastToOthers(socketId, {
                type: 'remote_bullets',
                shooterId: playerState.userId,
                shooterUsername: playerState.username,
                bullets: data.bullets
              });
              break;

            case 'bullet_hit':
              if (!playerState || !data.targetId) return;
              
              let targetPlayer = null;
              arenaState.players.forEach(p => {
                if (p.userId === data.targetId) {
                  targetPlayer = p;
                }
              });
              
              if (targetPlayer) {
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

            case 'player_killed':
              if (!playerState || !data.victimUserId || !data.killMethod) return;

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

              broadcastToAll({
                type: 'player_killed',
                killerId: playerState.userId,
                killerUsername: playerState.username,
                victimId: data.victimUserId,
                victimUsername: data.victimUsername,
                killMethod: data.killMethod
              });
              break;

            case 'player_kill':
              if (!playerState || !data.victimId) return;
              
              let killerPlayer = null;
              arenaState.players.forEach(p => {
                if (p.userId === data.killerId) {
                  killerPlayer = p;
                  p.kills = (p.kills || 0) + 1;
                }
              });
              
              let victimName = 'Desconocido';
              arenaState.players.forEach(p => {
                if (p.userId === data.victimId) {
                  victimName = p.username;
                }
              });
              
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
              const killerInfo = data.killerInfo;

              if (killerInfo && killerInfo.killerUsername) {
                let killerSocketId = null;
                let killerState = null;
                arenaState.players.forEach((p, sid) => {
                  if (p.username === killerInfo.killerUsername) {
                    killerSocketId = sid;
                    killerState = p;
                  }
                });
                
                if (killerState && killerSocketId) {
                  killerState.kills = (killerState.kills || 0) + 1;
                  
                  const killerSocket = arenaState.connections.get(killerSocketId);
                  if (killerSocket && killerSocket.readyState === 1) {
                    killerSocket.send(JSON.stringify({
                      type: 'kill_confirmed',
                      victimUsername: playerState.username,
                      victimId: playerState.userId,
                      killMethod: killerInfo.killMethod || 'bullet'
                    }));
                  }
                  
                  broadcastToAll({
                    type: 'player_killed',
                    killerId: killerState.userId,
                    killerUsername: killerState.username,
                    victimId: playerState.userId,
                    victimUsername: playerState.username,
                    killMethod: killerInfo.killMethod || 'bullet'
                  });
                  
                  console.log(`[Arena] ${killerState.username} killed ${playerState.username} via ${killerInfo.killMethod}`);
                }
              }

              try {
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
                    [userId, arenaConfigId, sessionXP, killCount, 1, durationSeconds]
                  );

                  currentArenaSessionId = sessionResult.rows[0].id;
                }

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

              arenaState.players.delete(socketId);
              arenaState.connections.delete(socketId);

              broadcastToOthers(socketId, {
                type: 'player_left',
                userId: playerState.userId,
                username: playerState.username
              });

              console.log(`[Arena] ${username} (${userId}) died with ${sessionXP} XP and ${killCount} kills`);
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
          console.log(`[Arena] ${username || 'Unknown'} disconnected. Total players: ${arenaState.players.size}`);
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
    foodCount: arenaState.food.length,
    enemyCount: arenaState.enemies.length,
    lastUpdate: arenaState.lastUpdate
  };
}
