import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Shield, Zap, Magnet, Gauge, Heart } from 'lucide-react';
import AdminPanel from './components/AdminPanel';

// Configuración de niveles - cada nivel tiene características particulares
// Esta función ahora usa los niveles cargados desde la DB si están disponibles
const getLevelConfig = (level, levelConfigsFromDB = {}) => {
  // Si tenemos configuración desde la DB para este nivel, usarla
  if (levelConfigsFromDB[level]) {
    const dbConfig = levelConfigsFromDB[level];
    return {
      starsNeeded: dbConfig.starsNeeded,
      playerSpeed: dbConfig.playerSpeed,
      enemySpeed: dbConfig.enemySpeed,
      enemyCount: dbConfig.enemyCount,
      enemyDensity: dbConfig.enemyDensity,
      enemyShootPercentage: dbConfig.enemyShootPercentage,
      enemyShieldPercentage: dbConfig.enemyShieldPercentage,
      enemyShootCooldown: dbConfig.enemyShootCooldown,
      xpDensity: dbConfig.xpDensity,
      xpPoints: dbConfig.xpPoints ?? dbConfig.xpDensity,
      mapSize: dbConfig.mapSize ?? 10,
      structuresCount: dbConfig.structuresCount ?? 0,
      killerSawCount: dbConfig.killerSawCount ?? 0,
      floatingCannonCount: dbConfig.floatingCannonCount ?? 0,
      resentfulSnakeCount: dbConfig.resentfulSnakeCount ?? 0,
      healthBoxCount: dbConfig.healthBoxCount ?? 0,
      hasCentralCell: dbConfig.hasCentralCell,
      centralCellOpeningSpeed: dbConfig.centralCellOpeningSpeed,
    };
  }

  // Fallback a configuración hardcodeada si no hay datos de DB
  const baseConfig = {
    starsNeeded: Math.max(1, Math.floor(level * 0.5) + 1),
    playerSpeed: 2 + (level * 0.1),
    enemySpeed: 2 + (level * 0.15),
    enemyCount: level === 1 ? 5 : level === 2 ? 10 : 10 + (level - 2) * 3,
    enemyDensity: 15 + (level * 2),
    enemyShootPercentage: Math.min(30 + (level * 5), 80),
    enemyShieldPercentage: Math.min(0 + (level * 3), 50),
    enemyShootCooldown: Math.max(2000, 5000 - (level * 100)),
    xpDensity: 100 + (level * 5),
    xpPoints: 100 + (level * 5),
    mapSize: 10 + level,
    structuresCount: 0,
    killerSawCount: 0,
    floatingCannonCount: 0,
    resentfulSnakeCount: 0,
    healthBoxCount: 0,
    hasCentralCell: level >= 2,
    centralCellOpeningSpeed: 0.002, // Velocidad fija igual para todos los niveles
  };

  const levelSpecificConfigs = {
    1: {
      starsNeeded: 1,
      playerSpeed: 2,
      enemySpeed: 2,
      enemyCount: 5,
      enemyDensity: 15,
      enemyShootPercentage: 0,
      enemyShieldPercentage: 0,
      enemyShootCooldown: 5000,
      xpDensity: 100,
      hasCentralCell: false,
      centralCellOpeningSpeed: 0.002,
    },
    2: {
      starsNeeded: 2,
      playerSpeed: 2.2,
      enemySpeed: 2.3,
      enemyCount: 10,
      enemyDensity: 18,
      enemyShootPercentage: 10,
      enemyShieldPercentage: 0,
      enemyShootCooldown: 4500,
      xpDensity: 110,
      hasCentralCell: true,
      centralCellOpeningSpeed: 0.002,
    },
    3: {
      starsNeeded: 2,
      playerSpeed: 2.4,
      enemySpeed: 2.6,
      enemyCount: 13,
      enemyDensity: 21,
      enemyShootPercentage: 20,
      enemyShieldPercentage: 5,
      enemyShootCooldown: 4000,
      xpDensity: 120,
      hasCentralCell: true,
      centralCellOpeningSpeed: 0.002,
    },
    4: {
      starsNeeded: 3,
      playerSpeed: 2.6,
      enemySpeed: 2.9,
      enemyCount: 16,
      enemyDensity: 24,
      enemyShootPercentage: 30,
      enemyShieldPercentage: 10,
      enemyShootCooldown: 3500,
      xpDensity: 130,
      hasCentralCell: true,
      centralCellOpeningSpeed: 0.002,
    },
    5: {
      starsNeeded: 3,
      playerSpeed: 2.8,
      enemySpeed: 3.2,
      enemyCount: 19,
      enemyDensity: 27,
      enemyShootPercentage: 40,
      enemyShieldPercentage: 15,
      enemyShootCooldown: 3000,
      xpDensity: 140,
      hasCentralCell: true,
      centralCellOpeningSpeed: 0.002,
    },
  };

  return levelSpecificConfigs[level] || baseConfig;
};

const SnakeGame = ({ user, onLogout, isAdmin = false, isBanned = false, freeShots = false }) => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Mobile controls state
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [joystickDirection, setJoystickDirection] = useState({ x: 0, y: 0 });
  const joystickRef = useRef({ 
    centerX: 0, 
    centerY: 0, 
    radius: 0, 
    isActive: false,
    direction: { x: 0, y: 0 }, // Store direction synchronously
    intensity: 0 // 0-1, qué tan lejos está el dedo del centro (para aceleración)
  });
  const shootBulletRef = useRef(null);
  const isShootingRef = useRef(false);
  const shootingIntervalRef = useRef(null);
  const startAutoFireRef = useRef(null);
  const stopAutoFireRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // menu, playing, levelComplete, gameComplete, gameOver, shop
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [totalXP, setTotalXP] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [currentLevelStars, setCurrentLevelStars] = useState(0);
  const [currentLevelXP, setCurrentLevelXP] = useState(0);
  const [shieldLevel, setShieldLevel] = useState(0); // 0-10: resistencia visual (ya no afecta vida)
  const [magnetLevel, setMagnetLevel] = useState(0); // 0-10: rango de atracción (50px por nivel)
  const [cannonLevel, setCannonLevel] = useState(0); // 0 = none, 1-5 = diferentes configuraciones
  const [speedLevel, setSpeedLevel] = useState(0); // 0 = none, 1-10 = 10% a 100%
  const [bulletSpeedLevel, setBulletSpeedLevel] = useState(0); // 0-10: velocidad suma 2 por nivel, máximo 20
  const [headLevel, setHeadLevel] = useState(1); // 1 = normal, 2 = double, 3 = triple
  const [healthLevel, setHealthLevel] = useState(0); // 0-10: puntos de vida (0=2, 1=4, 2=6... 10=22)
  const [shopOpen, setShopOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shopConfigs, setShopConfigs] = useState(null); // Configuraciones de la tienda desde la DB
  const [leaderboard, setLeaderboard] = useState([]); // Leaderboard data
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState({}); // Configuraciones de niveles desde la DB
  const [victoryData, setVictoryData] = useState(null); // Datos de victoria nivel 25
  const [rebirthCount, setRebirthCount] = useState(0); // Contador de rebirths
  const [currentSeries, setCurrentSeries] = useState(1); // Serie actual
  
  // Constants for canvas and world size
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  // BASE_UNIT es el tamaño de la pantalla visible (canvas), no la ventana completa
  const BASE_UNIT = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT);
  const SNAKE_SIZE = 8;
  const FOOD_SIZE = 6;
  const BORDER_WIDTH = 20;
  
  const gameRef = useRef({
    snake: [{ x: 300, y: 300 }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    food: [],
    stars: [], // New: stars collection
    enemies: [],
    particles: [],
    bullets: [],
    killerSaws: [], // Sierras asesinas
    floatingCannons: [], // Canones flotantes
    resentfulSnakes: [], // Viboras resentidas
    healthBoxes: [], // Cajas de vida
    structures: [], // Estructuras con puertas moviles
    speed: 2, // Start slower
    baseSpeed: 2,
    snakeSize: 8,
    level: 1,
    starsNeeded: 1, // Stars needed for current level
    currentStars: 0, // Stars collected in current level
    currentXP: 0,
    mousePos: { x: 400, y: 300 },
    camera: { x: 0, y: 0 },
    enemyDensity: 23, // Configurable: more enemies = higher density (1.5x original)
    gameStartTime: null,
    sessionXP: 0,
    lastPlayerShot: 0, // For cannon cooldown
    currentHealth: 2, // Vida actual del jugador
    maxHealth: 2, // Vida máxima del jugador (basada en healthLevel)
    magnetLevel: 0, // Nivel del imán (se actualiza desde el state)
    worldWidth: BASE_UNIT * 10, // Dynamic world width based on level
    worldHeight: BASE_UNIT * 10, // Dynamic world height based on level
    // Efectos visuales
    damageFlash: 0, // Tiempo de flash rojo cuando recibe daño
    healFlash: 0, // Tiempo de flash verde cuando se cura
    invulnerable: 0 // Tiempo de invulnerabilidad después de recibir daño
  });

  // Helper function to get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load level configurations from API
  const loadLevelConfigs = async () => {
    try {
      const response = await fetch('/api/admin/levels', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const configsMap = {};
        data.forEach(level => {
          configsMap[level.levelNumber] = {
            starsNeeded: level.starsNeeded,
            playerSpeed: level.playerSpeed,
            enemySpeed: level.enemySpeed,
            enemyCount: level.enemyCount,
            enemyDensity: level.enemyDensity,
            enemyShootPercentage: level.enemyShootPercentage,
            enemyShieldPercentage: level.enemyShieldPercentage,
            enemyShootCooldown: level.enemyShootCooldown,
            xpDensity: level.xpDensity,
            xpPoints: level.xpPoints ?? level.xpDensity,
            mapSize: level.mapSize ?? 10,
            structuresCount: level.structuresCount ?? 0,
            killerSawCount: level.killerSawCount ?? 0,
            floatingCannonCount: level.floatingCannonCount ?? 0,
            resentfulSnakeCount: level.resentfulSnakeCount ?? 0,
            healthBoxCount: level.healthBoxCount ?? 0,
            hasCentralCell: level.hasCentralCell,
            centralCellOpeningSpeed: level.centralCellOpeningSpeed,
          };
        });
        setLevelConfigs(configsMap);
      }
    } catch (error) {
      console.error('Error loading level configs:', error);
      // Fallback to hardcoded configs
    }
  };

  // Load shop configurations from API
  const loadShopConfigs = async () => {
    try {
      const response = await fetch('/api/shop/upgrades');
      if (!response.ok) {
        throw new Error('Failed to load shop configurations');
      }
      const data = await response.json();
      setShopConfigs(data);
    } catch (error) {
      console.error('Error loading shop configs:', error);
      // Fallback to default configs if API fails
      setShopConfigs({
        shield: [
          { level: 1, xpCost: 0, starsCost: 5, description: 'Escudo en la cabeza' },
          { level: 2, xpCost: 0, starsCost: 5, description: 'Escudo atrás y adelante' },
          { level: 3, xpCost: 0, starsCost: 5, description: 'Escudo todo el cuerpo' },
          { level: 4, xpCost: 0, starsCost: 10, description: 'Protección x 2 todo el cuerpo' },
          { level: 5, xpCost: 0, starsCost: 10, description: 'Protección x 3 todo el cuerpo' }
        ],
        magnet: [
          { level: 1, xpCost: 0, starsCost: 5, description: 'Atrae XP y estrellas a 25px de la cabeza' },
          { level: 2, xpCost: 0, starsCost: 5, description: 'Atrae XP y estrellas a 50px de la cabeza' },
          { level: 3, xpCost: 0, starsCost: 5, description: 'Atrae XP y estrellas a 75px de la cabeza' },
          { level: 4, xpCost: 0, starsCost: 5, description: 'Atrae XP y estrellas a 100px de la cabeza' },
          { level: 5, xpCost: 0, starsCost: 5, description: 'Atrae XP y estrellas a 125px de la cabeza' },
          { level: 6, xpCost: 0, starsCost: 10, description: 'Atrae XP y estrellas a 150px de la cabeza' },
          { level: 7, xpCost: 0, starsCost: 10, description: 'Atrae XP y estrellas a 175px de la cabeza' },
          { level: 8, xpCost: 0, starsCost: 10, description: 'Atrae XP y estrellas a 200px de la cabeza' },
          { level: 9, xpCost: 0, starsCost: 15, description: 'Atrae XP y estrellas a 225px de la cabeza' },
          { level: 10, xpCost: 0, starsCost: 15, description: 'Atrae XP y estrellas a 250px de la cabeza' }
        ],
        cannon: [
          { level: 1, xpCost: 250, starsCost: 10, description: 'Cañón en la cabeza que tira de a 1 bala. Un disparo x segundo' },
          { level: 2, xpCost: 500, starsCost: 10, description: 'Doble Cañón en la cabeza que tira de a 2 balas en total. Una bala por cañón. Un disparo x segundo' },
          { level: 3, xpCost: 750, starsCost: 10, description: 'Doble Cañón en la cabeza que tira de a 2 balas en total. Se suma un cañon en la cola. Una bala por cañón. Un disparo x segundo' },
          { level: 4, xpCost: 750, starsCost: 10, description: 'Doble Cañón en la cabeza que tira de a 2 balas en total. Se suma un cañon doble en la cola. Una bala por cañón. Un disparo x segundo' },
          { level: 5, xpCost: 1000, starsCost: 10, description: 'Lo mismo que el anterior, se aceleran los disparos de uno x segundo a dos por segundo' }
        ],
        speed: [
          { level: 1, xpCost: 100, starsCost: 0, description: 'Extra velocidad x 10%' },
          { level: 2, xpCost: 200, starsCost: 0, description: 'Extra velocidad x 20%' },
          { level: 3, xpCost: 300, starsCost: 0, description: 'Extra velocidad x 30%' },
          { level: 4, xpCost: 400, starsCost: 0, description: 'Extra velocidad x 40%' },
          { level: 5, xpCost: 500, starsCost: 0, description: 'Extra velocidad x 50%' },
          { level: 6, xpCost: 600, starsCost: 0, description: 'Extra velocidad x 60%' },
          { level: 7, xpCost: 700, starsCost: 0, description: 'Extra velocidad x 70%' },
          { level: 8, xpCost: 800, starsCost: 0, description: 'Extra velocidad x 80%' },
          { level: 9, xpCost: 900, starsCost: 0, description: 'Extra velocidad x 90%' },
          { level: 10, xpCost: 1000, starsCost: 0, description: 'Extra velocidad x 100%' }
        ],
        health: [
          { level: 1, xpCost: 150, starsCost: 5, description: '4 puntos de vida máximos' },
          { level: 2, xpCost: 150, starsCost: 5, description: '6 puntos de vida máximos' },
          { level: 3, xpCost: 150, starsCost: 5, description: '8 puntos de vida máximos' },
          { level: 4, xpCost: 150, starsCost: 5, description: '10 puntos de vida máximos' },
          { level: 5, xpCost: 150, starsCost: 5, description: '12 puntos de vida máximos' },
          { level: 6, xpCost: 150, starsCost: 5, description: '14 puntos de vida máximos' },
          { level: 7, xpCost: 150, starsCost: 5, description: '16 puntos de vida máximos' },
          { level: 8, xpCost: 150, starsCost: 5, description: '18 puntos de vida máximos' },
          { level: 9, xpCost: 150, starsCost: 5, description: '20 puntos de vida máximos' },
          { level: 10, xpCost: 150, starsCost: 5, description: '22 puntos de vida máximos' }
        ]
      });
    }
  };

  // Load user progress from API
  const loadUserProgress = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}/progress`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to load progress');
      }

      const data = await response.json();
      
      // Set loaded data
      setTotalXP(data.totalXp || 0);
      setTotalStars(data.totalStars || 0);
      setLevel(data.currentLevel || 1);
      setShieldLevel(data.shieldLevel || 0);
      setMagnetLevel(data.magnetLevel || 0);
      setCannonLevel(data.cannonLevel || 0);
      setSpeedLevel(data.speedLevel || 0);
      setBulletSpeedLevel(data.bulletSpeedLevel || 0);
      setHeadLevel(data.headLevel || 1);
      setHealthLevel(data.healthLevel || 0);
      setRebirthCount(data.rebirthCount || 0);
      setCurrentSeries(data.currentSeries || 1);
      gameRef.current.level = data.currentLevel || 1;
      gameRef.current.magnetLevel = data.magnetLevel || 0;
      
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load all initial data
  useEffect(() => {
    if (user?.id) {
      loadShopConfigs();
      loadUserProgress();
      loadLevelConfigs(); // Cargar configs de niveles para TODOS los usuarios
    }
  }, [user?.id]);

  // Handle ESC key to close admin panel
  useEffect(() => {
    if (!isAdmin) return;
    
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && showAdminPanel) {
        setShowAdminPanel(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAdminPanel, isAdmin]);

  // Save user progress to API
  const saveUserProgress = async () => {
    if (!user?.id) return;

    try {
      await fetch(`/api/users/${user.id}/progress`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          shieldLevel,
          headLevel,
          magnetLevel,
          cannonLevel,
          speedLevel,
          bulletSpeedLevel,
          healthLevel,
          currentLevel: level,
          totalXp: totalXP,
          totalStars: totalStars
        })
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  // Save game session to API
  const saveGameSession = async (finalScore, levelReached, xpEarned, durationSeconds) => {
    if (!user?.id) {
      console.warn('Cannot save session: no user id');
      return;
    }

    // Ensure we have valid values
    const sessionData = {
      score: finalScore || 0,
      levelReached: levelReached || 1,
      xpEarned: xpEarned || 0,
      durationSeconds: durationSeconds || 0
    };

    console.log('💾 Saving game session:', sessionData);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(sessionData)
      });
      
      if (response.ok) {
        console.log('✅ Session saved successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to save session:', response.status, errorData);
      }
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
  };

  // Load shop configs on mount
  useEffect(() => {
    loadShopConfigs();
  }, []);

  // Load leaderboard
  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard?limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  // Load progress on mount
  useEffect(() => {
    loadUserProgress();
  }, [user?.id]);

  // Load leaderboard when in menu, level complete or game complete
  useEffect(() => {
    if (gameState === 'menu' || gameState === 'levelComplete' || gameState === 'gameComplete') {
      loadLeaderboard();
    }
  }, [gameState]);

  // Auto-save progress when it changes (debounced)
  useEffect(() => {
    if (loading) return; // Don't save while loading initial data
    
    const timeoutId = setTimeout(() => {
      saveUserProgress();
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [totalXP, totalStars, level, shieldLevel, magnetLevel, cannonLevel, speedLevel, bulletSpeedLevel, healthLevel]);

  // Sincronizar magnetLevel con gameRef para el game loop
  useEffect(() => {
    gameRef.current.magnetLevel = magnetLevel;
  }, [magnetLevel]);

  // Helper function to calculate world size based on map size
  const getWorldSize = (mapSize) => {
    return BASE_UNIT * mapSize;
  };

  // Create food function - moved outside useEffect to be accessible everywhere
    const createFood = (forceColor = null, forceValue = null) => {
      const game = gameRef.current;
      // Rainbow colors: violet (most XP) -> red (least XP)
      const colorTiers = [
        { color: '#9400D3', hue: 280, xp: 7, name: 'violet' },    // Violet - 7 XP (smallest)
        { color: '#4B0082', hue: 275, xp: 6, name: 'indigo' },     // Indigo - 6 XP  
        { color: '#0000FF', hue: 240, xp: 5, name: 'blue' },       // Blue - 5 XP
        { color: '#00FF00', hue: 120, xp: 4, name: 'green' },      // Green - 4 XP
        { color: '#FFFF00', hue: 60, xp: 3, name: 'yellow' },      // Yellow - 3 XP
        { color: '#FFA500', hue: 39, xp: 2, name: 'orange' },      // Orange - 2 XP
        { color: '#FF0000', hue: 0, xp: 1, name: 'red' }           // Red - 1 XP (smallest)
      ];
      
      let tier;
      if (forceColor === 'yellow' || forceColor === 'orange') {
        tier = colorTiers.find(t => t.name === forceColor);
      } else {
        // Random weighted selection (lower XP more common)
        const rand = Math.random();
        if (rand < 0.05) tier = colorTiers[0]; // 5% violet
        else if (rand < 0.10) tier = colorTiers[1]; // 5% indigo
        else if (rand < 0.20) tier = colorTiers[2]; // 10% blue
        else if (rand < 0.35) tier = colorTiers[3]; // 15% green
        else if (rand < 0.55) tier = colorTiers[4]; // 20% yellow
        else if (rand < 0.75) tier = colorTiers[5]; // 20% orange
        else tier = colorTiers[6]; // 25% red
      }
      
      // 5 sizes: 1 (smallest) to 5 (largest)
      // XP ranges: red 1-5, orange 2-6, yellow 3-7, green 4-9, blue 5-10, indigo 6-11, violet 7-12
      const sizeIndex = Math.floor(Math.random() * 5); // 0-4
      const sizeMultiplier = 0.6 + (sizeIndex * 0.2); // 0.6, 0.8, 1.0, 1.2, 1.4
      
      // Calculate XP based on color base XP and size
      // Smallest size (0): base XP, Largest size (4): base XP + 4
      const baseXP = tier.xp;
      const xpValue = forceValue || (baseXP + sizeIndex);
      
      return {
        x: Math.random() * (game.worldWidth - 40) + 20,
        y: Math.random() * (game.worldHeight - 40) + 20,
        value: xpValue,
        color: tier.color,
        hue: tier.hue,
        size: FOOD_SIZE * sizeMultiplier,
        sizeIndex: sizeIndex // Store size index for reference
      };
    };

  // Helper function to create enemies - must be outside useEffect to be accessible
    const createEnemy = (levelConfig, gameLevel = 1) => {
      const game = gameRef.current;
      const x = Math.random() * game.worldWidth;
      const y = Math.random() * game.worldHeight;
      const angle = Math.random() * Math.PI * 2;
    const baseLength = 15 + Math.random() * 20;
    const initialXP = Math.floor(baseLength * 2); // Initial XP based on length
    
    // Sistema de mejoras progresivo según nivel del juego (1-25)
    // Nivel 1: sin mejoras, Nivel 25: mezcla de todo
    const getEnemyUpgrades = (level) => {
      if (level === 1) {
        // Nivel 1: sin mejoras
        return { shieldLevel: 0, cannonLevel: 0, speedLevel: 0, bulletSpeedLevel: 0, magnetLevel: 0, healthLevel: 0 };
      }
      
      // Probabilidad base de tener mejoras: aumenta con el nivel
      // Nivel 2: 10%, Nivel 25: 100%
      const upgradeChance = Math.min(1, (level - 1) / 24);
      
      // Nivel máximo de mejoras disponible: aumenta con el nivel
      // Nivel 2-5: max 1-2, Nivel 6-10: max 3-4, Nivel 11-15: max 5-6, etc.
      const maxUpgradeLevel = Math.min(10, Math.ceil(level / 2.5));
      
      // Función para determinar el nivel de una mejora
      const getUpgradeLevel = (maxPossible) => {
        if (Math.random() > upgradeChance) return 0;
        // En niveles altos, algunos enemigos tienen mejoras al máximo
        if (level >= 20 && Math.random() < 0.2) {
          return maxPossible; // 20% chance de tener al máximo en niveles 20+
        }
        // Random entre 0 y el máximo disponible para este nivel
        return Math.floor(Math.random() * (maxPossible + 1));
      };
      
      return {
        shieldLevel: getUpgradeLevel(Math.min(10, maxUpgradeLevel)),
        cannonLevel: getUpgradeLevel(Math.min(5, Math.ceil(maxUpgradeLevel / 2))),
        speedLevel: getUpgradeLevel(Math.min(10, maxUpgradeLevel)),
        bulletSpeedLevel: getUpgradeLevel(Math.min(10, maxUpgradeLevel)),
        magnetLevel: getUpgradeLevel(Math.min(10, maxUpgradeLevel)),
        healthLevel: getUpgradeLevel(Math.min(10, maxUpgradeLevel))
      };
    };
    
    const upgrades = getEnemyUpgrades(gameLevel);
    
    // Vida basada en healthLevel: nivel 0 = 2, nivel 1 = 4, nivel 2 = 6... nivel 10 = 22
    const enemyMaxHealth = 2 + (upgrades.healthLevel * 2);
    
    // Determinar si puede disparar basado en cannonLevel (ya no usa porcentaje random)
    const canShoot = upgrades.cannonLevel > 0;
    // Shield level > 0 significa que tiene escudo (visual)
    const hasShield = upgrades.shieldLevel > 0;
    
    // Velocidad base + bonus por speedLevel (10% por nivel)
    const baseSpeed = levelConfig.enemySpeed + (Math.random() * 0.5);
    const speedBonus = 1 + (upgrades.speedLevel * 0.1);
    
      return {
        segments: [{ x, y }],
        direction: { x: Math.cos(angle), y: Math.sin(angle) },
        speed: baseSpeed * speedBonus,
        baseSpeed: baseSpeed, // Guardar velocidad base para referencia
      length: baseLength,
      hue: Math.random() * 360,
      totalXP: initialXP, // Track XP accumulated by this enemy
      
      // Sistema de vida
      currentHealth: enemyMaxHealth, // Vida actual
      maxHealth: enemyMaxHealth, // Vida máxima
      healthLevel: upgrades.healthLevel, // Nivel de vida del enemigo
      starsEaten: 0, // Estrellas comidas - recuperan vida
      
      // Mejoras de tienda del enemigo
      shieldLevel: upgrades.shieldLevel, // 0-10: efecto visual de escudo
      cannonLevel: upgrades.cannonLevel, // 0-5: configuración de cañones
      speedLevel: upgrades.speedLevel, // 0-10: velocidad extra
      bulletSpeedLevel: upgrades.bulletSpeedLevel, // 0-10: velocidad de disparo
      magnetLevel: upgrades.magnetLevel, // 0-5: atracción de comida
      
      canShoot: canShoot, // Can this enemy shoot?
      hasShield: hasShield, // Does this enemy have shield?
      lastShotTime: 0, // Track when enemy last shot
      // Cooldown basado en bulletSpeedLevel (10% menos por nivel)
      shootCooldown: Math.max(500, levelConfig.enemyShootCooldown * (1 - upgrades.bulletSpeedLevel * 0.1))
    };
  };

  // Helper function to create Killer Saw
  const createKillerSaw = (levelConfig) => {
    const game = gameRef.current;
    // Tamaños: más grande = más daño
    const sizes = [20, 30, 40, 50, 60];
    const sizeDamages = [1, 2, 3, 4, 5]; // Daño según tamaño: pequeña=1, grande=5
    const colors = ['#ffdd00', '#ffaa00', '#ff6600', '#ff3300', '#ff0000']; // Amarillo (débil) a Rojo (fuerte)
    
    const sizeIndex = Math.floor(Math.random() * sizes.length);
    const size = sizes[sizeIndex];
    const damage = sizeDamages[sizeIndex]; // Daño basado en tamaño (1-5)
    const color = colors[sizeIndex]; // Color también basado en tamaño
    
    return {
      x: Math.random() * (game.worldWidth - size * 2) + size,
      y: Math.random() * (game.worldHeight - size * 2) + size,
      radius: size,
      color: color,
      damage: damage, // 1-5 según tamaño
      rotation: 0,
      rotationSpeed: 0.05 + Math.random() * 0.05,
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      },
      speed: 1 + Math.random()
    };
  };

  // Helper function to create Floating Cannon
  const createFloatingCannon = (levelConfig) => {
    const game = gameRef.current;
    return {
      x: Math.random() * (game.worldWidth - 100) + 50,
      y: Math.random() * (game.worldHeight - 100) + 50,
      angle: Math.random() * Math.PI * 2,
      shootCooldown: 0,
      shootInterval: 2000 + Math.random() * 1000,
      range: 400,
      bulletSpeed: 5
    };
  };

  // Helper function to create Resentful Snake
  const createResentfulSnake = (levelConfig) => {
    const game = gameRef.current;
    const x = Math.random() * game.worldWidth;
    const y = Math.random() * game.worldHeight;
    const angle = Math.random() * Math.PI * 2;
    
    return {
      segments: [{ x, y }],
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: levelConfig.enemySpeed * 1.2,
      length: 20 + Math.random() * 15,
      hue: 0, // Red hue for resentful
      isResentful: true,
      lastShotTime: 0,
      shootCooldown: 1500,
      chaseRange: 500
    };
  };

  // Helper function to create Health Box
  const createHealthBox = (levelConfig) => {
    const game = gameRef.current;
    const sizes = [1, 3, 5]; // Health points
    const sizeIndex = Math.floor(Math.random() * sizes.length);
    
    return {
      x: Math.random() * (game.worldWidth - 40) + 20,
      y: Math.random() * (game.worldHeight - 40) + 20,
      healthPoints: sizes[sizeIndex],
      size: 15 + sizeIndex * 5,
      pulse: 0,
      pulseSpeed: 0.05
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationId;
    
    // Delta time tracking for consistent game speed across all hardware
    let lastTime = performance.now();
    const TARGET_FPS = 60;
    const FRAME_TIME = 1000 / TARGET_FPS; // milliseconds per frame at target FPS

    const createParticle = (x, y, color, count = 8) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        gameRef.current.particles.push({
          x, y,
          vx: Math.cos(angle) * (2 + Math.random() * 2),
          vy: Math.sin(angle) * (2 + Math.random() * 2),
          life: 1,
          color
        });
      }
    };

    // Función para aplicar daño con efectos visuales
    const applyDamage = (damage, x, y) => {
      const game = gameRef.current;
      
      // Si está invulnerable, no recibe daño
      if (game.invulnerable > 0) {
        createParticle(x, y, '#00ffff', 5); // Efecto de escudo
        return false;
      }
      
      game.currentHealth -= damage;
      game.damageFlash = 30; // 30 frames de flash rojo (~0.5 segundos)
      game.invulnerable = 60; // 60 frames de invulnerabilidad (~1 segundo)
      
      createParticle(x, y, '#ff0000', 12);
      
      return game.currentHealth <= 0; // Retorna true si murió
    };

    // Función para aplicar curación con efectos visuales
    const applyHeal = (amount, x, y) => {
      const game = gameRef.current;
      const previousHealth = game.currentHealth;
      game.currentHealth = Math.min(game.currentHealth + amount, game.maxHealth);
      
      if (game.currentHealth > previousHealth) {
        game.healFlash = 20; // 20 frames de flash verde (~0.33 segundos)
        createParticle(x, y, '#00ff00', 10);
        return true;
      }
      return false;
    };

    const initGame = () => {
      const game = gameRef.current;
      const levelConfig = getLevelConfig(game.level, levelConfigs);
      
      // Update world size based on level map size
      const worldSize = getWorldSize(levelConfig.mapSize);
      game.worldWidth = worldSize;
      game.worldHeight = worldSize;
      
      console.log(`🗺️ Mapa nivel ${game.level}: mapSize=${levelConfig.mapSize}, BASE_UNIT=${BASE_UNIT}, worldSize=${worldSize}px`);
      
      game.snake = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }];
      game.direction = { x: 1, y: 0 };
      game.nextDirection = { x: 1, y: 0 };
      game.food = Array.from({ length: levelConfig.xpPoints }, createFood);
      game.stars = []; // Reset stars
      game.enemies = Array.from({ length: levelConfig.enemyCount }, () => createEnemy(levelConfig, game.level));
      
      // Initialize new entities
      game.killerSaws = Array.from({ length: levelConfig.killerSawCount }, () => createKillerSaw(levelConfig));
      game.floatingCannons = Array.from({ length: levelConfig.floatingCannonCount }, () => createFloatingCannon(levelConfig));
      game.resentfulSnakes = Array.from({ length: levelConfig.resentfulSnakeCount }, () => createResentfulSnake(levelConfig));
      game.healthBoxes = Array.from({ length: levelConfig.healthBoxCount }, () => createHealthBox(levelConfig));
      game.structures = [];
      
      console.log(`🎮 Inicializando nivel ${game.level} con ${game.enemies.length} enemigos, ${game.killerSaws.length} sierras, mapa ${levelConfig.mapSize}x${levelConfig.mapSize}`);
      game.particles = [];
      game.currentXP = 0;
      game.currentStars = 0;
      game.starsNeeded = levelConfig.starsNeeded;
      // Inicializar vida del jugador basada en healthLevel: 0=2, 1=4, 2=6... 10=22
      game.maxHealth = 2 + (healthLevel * 2);
      game.currentHealth = game.maxHealth;
      // Reset efectos visuales
      game.damageFlash = 0;
      game.healFlash = 0;
      game.invulnerable = 0;
      // Aplicar velocidad del nivel
      game.speed = levelConfig.playerSpeed;
      game.baseSpeed = levelConfig.playerSpeed;
      setCurrentLevelXP(0);
      setCurrentLevelStars(0);
    };

    const updateMousePos = (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      // Calculate scale factors (canvas might be stretched)
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      
      // Get position relative to canvas
      const mouseX = (clientX - rect.left) * scaleX;
      const mouseY = (clientY - rect.top) * scaleY;
      
      gameRef.current.mousePos = {
        x: mouseX,
        y: mouseY
      };
    };

    const handleMouseMove = (e) => {
      updateMousePos(e.clientX, e.clientY);
    };

    // Joystick handlers for mobile
    const handleJoystickStart = (e) => {
      if (!isMobile) return;
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      
      // Joystick area is bottom right (20px from bottom and right)
      const joystickCenterX = rect.right - 20 - 60; // 60px is half of 120px joystick size
      const joystickCenterY = rect.bottom - 20 - 60;
      const joystickRadius = 60; // Radius of joystick base
      
      const distance = Math.sqrt(
        Math.pow(touchX - joystickCenterX, 2) + 
        Math.pow(touchY - joystickCenterY, 2)
      );
      
      // Check if touch is within joystick activation area (2x radius)
      if (distance < joystickRadius * 2) {
        e.preventDefault();
        joystickRef.current.isActive = true;
        joystickRef.current.centerX = joystickCenterX;
        joystickRef.current.centerY = joystickCenterY;
        joystickRef.current.radius = joystickRadius;
        setJoystickActive(true);
        handleJoystickMove(e);
      }
    };

    const handleJoystickMove = (e) => {
      if (!isMobile || !joystickRef.current.isActive) return;
      e.preventDefault();
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;
      
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      
      const centerX = joystickRef.current.centerX;
      const centerY = joystickRef.current.centerY;
      const radius = joystickRef.current.radius;
      
      const dx = touchX - centerX;
      const dy = touchY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Calcular intensidad (0-1) basada en distancia desde el centro
      const intensity = Math.min(distance / radius, 1);
      joystickRef.current.intensity = intensity;
      
      if (distance < radius) {
        // Within circle - use actual position
        const rect = canvasRef.current.getBoundingClientRect();
        const dir = { x: dx / radius, y: dy / radius };
        setJoystickPosition({ 
          x: touchX - rect.left, 
          y: touchY - rect.top 
        });
        setJoystickDirection(dir);
        joystickRef.current.direction = dir; // Store synchronously
      } else {
        // Outside circle - clamp to edge (intensidad máxima = 1)
        const angle = Math.atan2(dy, dx);
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const rect = canvasRef.current.getBoundingClientRect();
        setJoystickPosition({ 
          x: (centerX + Math.cos(angle) * radius) - rect.left, 
          y: (centerY + Math.sin(angle) * radius) - rect.top 
        });
        setJoystickDirection(dir);
        joystickRef.current.direction = dir; // Store synchronously
      }
    };

    const handleJoystickEnd = (e) => {
      if (!isMobile) return;
      e.preventDefault();
      joystickRef.current.isActive = false;
      joystickRef.current.direction = { x: 0, y: 0 };
      joystickRef.current.intensity = 0;
      setJoystickActive(false);
      setJoystickPosition({ x: 0, y: 0 });
      setJoystickDirection({ x: 0, y: 0 });
    };

    const handleTouchMove = (e) => {
      if (isMobile) {
        if (joystickRef.current.isActive) {
          handleJoystickMove(e);
          e.preventDefault();
        }
        return;
      }
      e.preventDefault(); // Prevent scrolling on desktop
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateMousePos(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e) => {
      if (isMobile) {
        handleJoystickStart(e);
        return;
      }
      e.preventDefault(); // Prevent scrolling on desktop
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateMousePos(touch.clientX, touch.clientY);
      }
    };

    // Función para iniciar auto-fire (usa setTimeout recursivo para ajustarse a cambios)
    const startAutoFire = () => {
      if (shootingIntervalRef.current) return; // Ya está activo
      
      const scheduleNextShot = () => {
        if (!isShootingRef.current || cannonLevel === 0) {
          shootingIntervalRef.current = null;
          return;
        }
        
        // Calcular cooldown basado en valores actuales (se actualiza automáticamente)
        const baseCooldown = cannonLevel === 5 ? 500 : 1000;
        const cooldownReduction = bulletSpeedLevel * 0.1;
        const cooldown = Math.max(50, baseCooldown * (1 - cooldownReduction));
        
        // Disparar
        if (shootBulletRef.current) {
          shootBulletRef.current();
        }
        
        // Programar siguiente disparo
        shootingIntervalRef.current = setTimeout(scheduleNextShot, cooldown);
      };
      
      // Iniciar el ciclo
      scheduleNextShot();
    };

    // Función para detener auto-fire
    const stopAutoFire = () => {
      isShootingRef.current = false;
      if (shootingIntervalRef.current) {
        clearTimeout(shootingIntervalRef.current);
        shootingIntervalRef.current = null;
      }
    };

    // Guardar en refs para acceder desde JSX
    startAutoFireRef.current = startAutoFire;
    stopAutoFireRef.current = stopAutoFire;

    const handleKeyDown = (e) => {
      // Don't handle keys if admin panel is open
      if (showAdminPanel) return;
      
      if (e.key.toLowerCase() === 'j') {
        setShopOpen(prev => !prev);
      } else if (e.key === ' ' && cannonLevel > 0) {
        e.preventDefault();
        if (!isShootingRef.current) {
          isShootingRef.current = true;
          shootBullet(); // Disparo inmediato
          startAutoFire(); // Iniciar auto-fire
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        stopAutoFire();
      }
    };

    const handleMouseDown = (e) => {
      // Don't handle mouse if admin panel is open or shop is open
      if (showAdminPanel || shopOpen) return;
      
      // Solo botón izquierdo (button === 0) y solo si tiene cañón
      if (e.button === 0 && cannonLevel > 0) {
        e.preventDefault();
        if (!isShootingRef.current) {
          isShootingRef.current = true;
          shootBullet(); // Disparo inmediato
          startAutoFire(); // Iniciar auto-fire
        }
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        stopAutoFire();
      }
    };

    const shootBullet = () => {
      const game = gameRef.current;
      if (!game.snake || game.snake.length === 0) {
        return;
      }
      
      if (cannonLevel === 0) {
        return;
      }
      
      // Calcular cuántas balas se disparan (costo en XP)
      // Level 1: 1 bala, Level 2: 2 balas, Level 3: 3 balas, Level 4-5: 4 balas
      let bulletCount = 1;
      if (cannonLevel >= 2) bulletCount = 2; // Doble cañón cabeza
      if (cannonLevel >= 3) bulletCount = 3; // + 1 cola
      if (cannonLevel >= 4) bulletCount = 4; // + 2 cola
      
      // Verificar que hay suficiente XP para disparar (excepto si tiene freeShots)
      if (!freeShots && game.sessionXP < bulletCount) {
        return; // No hay suficiente XP
      }
      
      // Initialize lastPlayerShot if not exists
      if (game.lastPlayerShot === undefined) {
        game.lastPlayerShot = 0;
      }
      
      const currentTime = Date.now();
      
      // Calcular cooldown: base según cannonLevel, reducido por bulletSpeedLevel
      // Base: cannon level 5 = 500ms, otros = 1000ms
      const baseCooldown = cannonLevel === 5 ? 500 : 1000;
      // bulletSpeedLevel reduce el cooldown LINEALMENTE: cada nivel resta 2ms * 10 = 20ms máximo
      // Nivel 0: base, Nivel 1: base-2, Nivel 2: base-4, ..., Nivel 10: base-20
      const cooldownReduction = bulletSpeedLevel * 2; // 2ms por nivel, máximo 20ms con nivel 10
      const cooldown = Math.max(50, baseCooldown - cooldownReduction); // Mínimo 50ms
      
      if (currentTime - game.lastPlayerShot < cooldown) {
        return; // Still on cooldown
      }
      
      // Consumir XP por disparo (excepto si tiene freeShots)
      if (!freeShots) {
        game.sessionXP -= bulletCount;
        setScore(game.sessionXP); // Actualizar el score visual
      }
      
      game.lastPlayerShot = currentTime;
      
      const head = game.snake[0];
      const tail = game.snake.length > 1 ? game.snake[game.snake.length - 1] : null;
      
      // Calculate direction for head (forward)
      const headAngle = Math.atan2(game.direction.y, game.direction.x);
      const headPerpAngle = headAngle + Math.PI / 2;
      
      // Calculate direction for tail (backward)
      let tailAngle = 0;
      let tailPerpAngle = 0;
      if (tail) {
        const tailDx = head.x - tail.x;
        const tailDy = head.y - tail.y;
        const tailDist = Math.sqrt(tailDx * tailDx + tailDy * tailDy);
        if (tailDist > 0) {
          tailAngle = Math.atan2(tailDy, tailDx);
          tailPerpAngle = tailAngle + Math.PI / 2;
        }
      }
      
      // Cannon configurations:
      // Level 1: 1 bullet from head
      // Level 2: 2 bullets from head (double cannon)
      // Level 3: 2 bullets from head + 1 from tail
      // Level 4: 2 bullets from head + 2 from tail (double cannon tail)
      // Level 5: Same as 4 but faster (2 shots/sec)
      
      // Velocidad de bala: escala lineal de nivel 1 (4) a nivel 10 (12)
      // Nivel 0 sin mejora = 4, Nivel 1 = 4, Nivel 2 = 4.89, ..., Nivel 10 = 12
      // Fórmula: 4 + ((nivel - 1) * 8 / 9) para niveles 1-10
      const bulletSpeed = bulletSpeedLevel >= 1 
        ? 4 + ((bulletSpeedLevel - 1) * 8 / 9)
        : 4; // Sin mejora = velocidad mínima
      
      if (cannonLevel >= 1) {
        // Head cannons (always forward)
        // Velocidad relativa a la víbora: bala + velocidad de la víbora
        const headBulletCount = cannonLevel >= 2 ? 2 : 1;
        const snakeSpeed = game.speed || 2; // Velocidad actual de la víbora
        for (let i = 0; i < headBulletCount; i++) {
          const offset = headBulletCount === 2 ? (i === 0 ? -15 : 15) : 0;
        game.bullets.push({
            x: head.x + Math.cos(headPerpAngle) * offset,
            y: head.y + Math.sin(headPerpAngle) * offset,
            // Sumar velocidad de la víbora para que la bala salga adelante
            vx: game.direction.x * (bulletSpeed + snakeSpeed),
            vy: game.direction.y * (bulletSpeed + snakeSpeed),
          life: 100,
          owner: 'player'
        });
      }
      }
      
      if (cannonLevel >= 3 && tail) {
        // Tail cannon(s) (shoot backward)
        const tailBulletCount = cannonLevel >= 4 ? 2 : 1;
        const tailDir = {
          x: -game.direction.x,
          y: -game.direction.y
        };
        
        for (let i = 0; i < tailBulletCount; i++) {
          const offset = tailBulletCount === 2 ? (i === 0 ? -15 : 15) : 0;
          game.bullets.push({
            x: tail.x + Math.cos(tailPerpAngle) * offset,
            y: tail.y + Math.sin(tailPerpAngle) * offset,
            vx: tailDir.x * bulletSpeed,
            vy: tailDir.y * bulletSpeed,
            life: 100,
            owner: 'player'
          });
        }
      }
    };
    
    // Store shootBullet in ref so it can be accessed from JSX
    shootBulletRef.current = shootBullet;

    const checkCollision = (pos1, pos2, distance) => {
      if (!distance) distance = gameRef.current.snakeSize * 2;
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      return Math.sqrt(dx * dx + dy * dy) < distance;
    };

    // Draw 5-pointed star
    const drawStar = (ctx, x, y, radius, rotation = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.beginPath();
      
      const outerRadius = radius;
      const innerRadius = radius * 0.4;
      
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * i) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      
      ctx.closePath();
      ctx.restore();
    };

    // Create food and star from dead enemy
    // starsToCreate: número de estrellas a crear (1 + estrellas que había comido el enemigo)
    const createFoodFromEnemy = (x, y, totalXP, starsToCreate = 1) => {
      const game = gameRef.current;
      const foodCount = Math.min(20, Math.max(5, Math.floor(totalXP / 5))); // 5-20 food items
      const xpPerFood = Math.floor(totalXP / foodCount);
      const spreadRadius = 100; // Spread food in 100px radius
      
      for (let i = 0; i < foodCount; i++) {
        const angle = (Math.PI * 2 * i) / foodCount + Math.random() * 0.5;
        const distance = Math.random() * spreadRadius;
        const foodX = x + Math.cos(angle) * distance;
        const foodY = y + Math.sin(angle) * distance;
        
        // Create high-value food (yellow/orange for visibility)
        const food = createFood(Math.random() < 0.5 ? 'yellow' : 'orange', xpPerFood);
        food.x = Math.max(BORDER_WIDTH, Math.min(game.worldWidth - BORDER_WIDTH, foodX));
        food.y = Math.max(BORDER_WIDTH, Math.min(game.worldHeight - BORDER_WIDTH, foodY));
        game.food.push(food);
      }
      
      // Create golden stars at the death location (1 propia + las que había comido)
      // Todas las estrellas de la misma víbora comparten un groupId para limitar curación
      const starGroupId = Date.now() + Math.random(); // ID único para este grupo de estrellas
      
      for (let i = 0; i < starsToCreate; i++) {
        // Distribuir las estrellas en un pequeño radio si son varias
        const starAngle = starsToCreate > 1 ? (Math.PI * 2 * i) / starsToCreate : 0;
        const starRadius = starsToCreate > 1 ? 30 : 0;
        
      gameRef.current.stars.push({
          x: x + Math.cos(starAngle) * starRadius,
          y: y + Math.sin(starAngle) * starRadius,
        size: 20,
        rotation: 0,
        rotationSpeed: 0.02,
        pulse: 0,
        pulseSpeed: 0.05,
        groupId: starGroupId, // ID del grupo para limitar curación a 1 por víbora muerta
        healedAlready: false // Se marca true cuando el grupo ya curó
      });
      }
    };

    const updateEnemies = (normalizedDelta) => {
      const game = gameRef.current;
      const enemiesToRemove = [];
      
      game.enemies.forEach((enemy, enemyIndex) => {
        const head = enemy.segments[0];
        
        // === INTELIGENCIA DEL ENEMIGO ===
        let targetingStar = false;
        let avoidingPlayer = false;
        const playerHead = game.snake[0];
        
        // 1. EVASIÓN DEL JUGADOR - Prioridad alta
        // Detectar si el jugador está cerca y esquivarlo
        const dxPlayer = head.x - playerHead.x;
        const dyPlayer = head.y - playerHead.y;
        const distanceToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
        
        // Rango de detección para esquivar (más cerca = reacción más fuerte)
        const avoidRange = 150;
        const criticalRange = 80;
        
        if (distanceToPlayer < avoidRange && distanceToPlayer > 0) {
          avoidingPlayer = true;
          
          // Calcular dirección de escape (alejarse del jugador)
          const escapeX = dxPlayer / distanceToPlayer;
          const escapeY = dyPlayer / distanceToPlayer;
          
          // Si está muy cerca, escapar más agresivamente
          if (distanceToPlayer < criticalRange) {
            // Escape directo + componente perpendicular para no ir en línea recta
            const perpX = -escapeY;
            const perpY = escapeX;
            const sideEscape = (Math.random() < 0.5 ? 1 : -1) * 0.5;
            
            enemy.direction = {
              x: escapeX * 0.8 + perpX * sideEscape,
              y: escapeY * 0.8 + perpY * sideEscape
            };
          } else {
            // Mezclar dirección actual con escape suave
            const escapeStrength = 1 - (distanceToPlayer / avoidRange);
            enemy.direction = {
              x: enemy.direction.x * (1 - escapeStrength) + escapeX * escapeStrength,
              y: enemy.direction.y * (1 - escapeStrength) + escapeY * escapeStrength
            };
          }
          
          // Normalizar dirección
          const dirLen = Math.sqrt(enemy.direction.x * enemy.direction.x + enemy.direction.y * enemy.direction.y);
          if (dirLen > 0) {
            enemy.direction.x /= dirLen;
            enemy.direction.y /= dirLen;
          }
        }
        
        // 2. BUSCAR ESTRELLAS - Solo si no está escapando del jugador
        if (!avoidingPlayer && game.stars && game.stars.length > 0) {
          let closestStar = null;
          let closestDistance = Infinity;
          
          for (const star of game.stars) {
            const dx = star.x - head.x;
            const dy = star.y - head.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < closestDistance) {
              closestDistance = distance;
              closestStar = star;
            }
          }
          
          // Si hay una estrella a menos de 600px, ir hacia ella
          if (closestStar && closestDistance < 600) {
            targetingStar = true;
            const dx = closestStar.x - head.x;
            const dy = closestStar.y - head.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              enemy.direction = { 
                x: dx / distance, 
                y: dy / distance 
              };
            }
          }
        }
        
        // 3. EVITAR COLISIÓN CON OTROS ENEMIGOS
        if (!avoidingPlayer && !targetingStar) {
          for (const otherEnemy of game.enemies) {
            if (otherEnemy === enemy) continue;
            if (!otherEnemy.segments || otherEnemy.segments.length === 0) continue;
            
            const otherHead = otherEnemy.segments[0];
            const dxOther = head.x - otherHead.x;
            const dyOther = head.y - otherHead.y;
            const distOther = Math.sqrt(dxOther * dxOther + dyOther * dyOther);
            
            // Si hay otro enemigo muy cerca, desviarse un poco
            if (distOther < 60 && distOther > 0) {
              const avoidStrength = 0.3;
              enemy.direction.x += (dxOther / distOther) * avoidStrength;
              enemy.direction.y += (dyOther / distOther) * avoidStrength;
              
              // Normalizar
              const len = Math.sqrt(enemy.direction.x * enemy.direction.x + enemy.direction.y * enemy.direction.y);
              if (len > 0) {
                enemy.direction.x /= len;
                enemy.direction.y /= len;
              }
              break;
            }
          }
        }
        
        // 4. MOVIMIENTO ALEATORIO - Solo si no tiene otro objetivo
        if (!avoidingPlayer && !targetingStar && Math.random() < 0.015 * normalizedDelta) {
          const angle = Math.random() * Math.PI * 2;
          enemy.direction = { x: Math.cos(angle), y: Math.sin(angle) };
        }
        let newX = head.x + enemy.direction.x * enemy.speed * normalizedDelta;
        let newY = head.y + enemy.direction.y * enemy.speed * normalizedDelta;

        // Bounce off world walls
        if (newX < BORDER_WIDTH || newX > game.worldWidth - BORDER_WIDTH) {
          enemy.direction.x *= -1;
          newX = Math.max(BORDER_WIDTH, Math.min(game.worldWidth - BORDER_WIDTH, newX));
        }
        if (newY < BORDER_WIDTH || newY > game.worldHeight - BORDER_WIDTH) {
          enemy.direction.y *= -1;
          newY = Math.max(BORDER_WIDTH, Math.min(game.worldHeight - BORDER_WIDTH, newY));
        }

        // Check collision with central rectangle walls (enemies must use openings too)
        if (game.centralRect) {
          const rect = game.centralRect;
          const headSize = SNAKE_SIZE;
          const wallThickness = 4;
          const collisionMargin = headSize + 2;
          
          // Helper to get opening position
          const getOpeningPos = (opening) => {
            if (opening.side === 'top' || opening.side === 'bottom') {
              return {
                x: rect.x + opening.position * (rect.width - opening.width),
                y: opening.side === 'top' ? rect.y : rect.y + rect.height - opening.height,
                width: opening.width,
                height: opening.height
              };
            } else {
              return {
                x: opening.side === 'left' ? rect.x : rect.x + rect.width - opening.width,
                y: rect.y + opening.position * (rect.height - opening.height),
                width: opening.width,
                height: opening.height
              };
            }
          };
          
          // Check collision with each wall and redirect if hitting wall (not opening)
          // Top wall
          if (newY >= rect.y - collisionMargin && newY <= rect.y + wallThickness + collisionMargin &&
              newX >= rect.x - collisionMargin && newX <= rect.x + rect.width + collisionMargin) {
            const topOpening = game.centralRect.openings.find(o => o.side === 'top');
            if (topOpening) {
              const opening = getOpeningPos(topOpening);
              // Check if NOT in the opening
              if (newX < opening.x - collisionMargin || newX > opening.x + opening.width + collisionMargin) {
                // Hit the wall, bounce back
                enemy.direction.y *= -1;
                newY = head.y; // Don't move forward
              }
            } else {
              // No opening, bounce back
              enemy.direction.y *= -1;
              newY = head.y;
            }
          }
          
          // Bottom wall
          if (newY >= rect.y + rect.height - wallThickness - collisionMargin && newY <= rect.y + rect.height + collisionMargin &&
              newX >= rect.x - collisionMargin && newX <= rect.x + rect.width + collisionMargin) {
            const bottomOpening = game.centralRect.openings.find(o => o.side === 'bottom');
            if (bottomOpening) {
              const opening = getOpeningPos(bottomOpening);
              if (newX < opening.x - collisionMargin || newX > opening.x + opening.width + collisionMargin) {
                enemy.direction.y *= -1;
                newY = head.y;
              }
            } else {
              enemy.direction.y *= -1;
              newY = head.y;
            }
          }
          
          // Left wall
          if (newX >= rect.x - collisionMargin && newX <= rect.x + wallThickness + collisionMargin &&
              newY >= rect.y - collisionMargin && newY <= rect.y + rect.height + collisionMargin) {
            const leftOpening = game.centralRect.openings.find(o => o.side === 'left');
            if (leftOpening) {
              const opening = getOpeningPos(leftOpening);
              if (newY < opening.y - collisionMargin || newY > opening.y + opening.height + collisionMargin) {
                enemy.direction.x *= -1;
                newX = head.x;
              }
            } else {
              enemy.direction.x *= -1;
              newX = head.x;
            }
          }
          
          // Right wall
          if (newX >= rect.x + rect.width - wallThickness - collisionMargin && newX <= rect.x + rect.width + collisionMargin &&
              newY >= rect.y - collisionMargin && newY <= rect.y + rect.height + collisionMargin) {
            const rightOpening = game.centralRect.openings.find(o => o.side === 'right');
            if (rightOpening) {
              const opening = getOpeningPos(rightOpening);
              if (newY < opening.y - collisionMargin || newY > opening.y + opening.height + collisionMargin) {
                enemy.direction.x *= -1;
                newX = head.x;
              }
            } else {
              enemy.direction.x *= -1;
              newX = head.x;
            }
          }
        }

        enemy.segments.unshift({
          x: Math.max(BORDER_WIDTH, Math.min(game.worldWidth - BORDER_WIDTH, newX)),
          y: Math.max(BORDER_WIDTH, Math.min(game.worldHeight - BORDER_WIDTH, newY))
        });

        if (enemy.segments.length > enemy.length) {
          enemy.segments.pop();
        }
        
        // Aplicar efecto magneto del enemigo para atraer comida
        const enemyMagnetLevel = enemy.magnetLevel || 0;
        if (enemyMagnetLevel > 0) {
          const magnetRange = 15 * enemyMagnetLevel; // 15px por nivel (menos que el jugador)
          
          game.food.forEach(food => {
            const dx = head.x - food.x;
            const dy = head.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < magnetRange && distance > 0) {
              const attractionStrength = (1 - distance / magnetRange) * 2.0;
              food.x += (dx / distance) * attractionStrength;
              food.y += (dy / distance) * attractionStrength;
            }
          });
        }

        // Enemies can eat food and accumulate XP
        game.food = game.food.filter(food => {
          if (checkCollision(head, food, SNAKE_SIZE + food.size)) {
            // Enemy eats food - accumulate XP and grow
            enemy.totalXP = (enemy.totalXP || 0) + food.value;
            enemy.length = Math.min(enemy.length + 2, 50); // Grow but cap at 50
            // Recalculate health based on XP: 1 bullet per 10 XP
            const newHealth = Math.max(1, Math.ceil(enemy.totalXP / 10));
            enemy.maxHealth = newHealth;
            // If health was reduced, restore it to max (enemies heal when eating)
            if (enemy.health < enemy.maxHealth) {
              enemy.health = enemy.maxHealth;
            }
            createParticle(head.x, head.y, food.color, 5);
            return false; // Remove food
          }
          return true; // Keep food
        });
        
        // Enemies can eat stars - recuperan vida hasta el máximo
        game.stars = game.stars.filter(star => {
          if (checkCollision(head, star, SNAKE_SIZE + star.size)) {
            // Enemy eats star - contador y recuperar vida
            enemy.starsEaten = (enemy.starsEaten || 0) + 1;
            
            // Recuperar vida hasta el máximo
            enemy.currentHealth = Math.min(enemy.currentHealth + enemy.maxHealth, enemy.maxHealth);
            
            // Efecto visual dorado al comer estrella
            createParticle(head.x, head.y, '#FFD700', 15);
            
            console.log(`🌟 Enemigo comió estrella! Estrellas: ${enemy.starsEaten}, Vida: ${enemy.currentHealth}/${enemy.maxHealth}`);
            return false; // Remove star
          }
          return true; // Keep star
        });

        // Check collision: Player head vs Enemy body (excluding enemy head)
        // Si el jugador choca con el cuerpo de un enemigo, recibe daño (no muerte instantánea)
        for (let i = 1; i < enemy.segments.length; i++) {
          if (checkCollision(playerHead, enemy.segments[i], game.snakeSize + SNAKE_SIZE)) {
            // Sistema de escudo: probabilidad de esquivar
            let dodged = false;
            if (shieldLevel > 0) {
              const dodgeChance = (shieldLevel - 1) / shieldLevel;
              dodged = Math.random() < dodgeChance;
            }
            
            if (!dodged) {
              // No esquivó - recibe daño con efectos visuales
              const damage = 3;
              const died = applyDamage(damage, playerHead.x, playerHead.y);
              
              // Si la vida llega a 0 o menos, el jugador muere
              if (died) {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
                saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            createParticle(playerHead.x, playerHead.y, '#ff3366', 20);
            setGameState('gameOver');
            return;
              }
            } else {
              // Esquivó - efecto visual azul brillante
              createParticle(playerHead.x, playerHead.y, '#00ffff', 12);
            }
            
            // Empujar al jugador hacia atrás para evitar múltiples colisiones seguidas (siempre)
            const dx = playerHead.x - enemy.segments[i].x;
            const dy = playerHead.y - enemy.segments[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
              const pushForce = 30;
              playerHead.x += (dx / distance) * pushForce;
              playerHead.y += (dy / distance) * pushForce;
            }
            
            break; // Solo una colisión por frame
          }
        }

        // Check collision: Enemy head vs Player body (excluding player head)
        // If enemy head hits player body, ENEMY dies
        const enemyHead = enemy.segments[0];
        for (let i = 1; i < game.snake.length; i++) {
          if (checkCollision(enemyHead, game.snake[i], SNAKE_SIZE + game.snakeSize)) {
            // Enemy dies - create food and stars (1 propia + las que comió)
            const deathX = enemyHead.x;
            const deathY = enemyHead.y;
            const enemyXP = enemy.totalXP || (enemy.length * 2); // Base XP on length if no XP tracked
            const starsToCreate = 1 + (enemy.starsEaten || 0);
            createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
            createParticle(deathX, deathY, '#ff3366', 15);
            enemiesToRemove.push(enemyIndex);
            break;
          }
        }

        // Enemy head vs Enemy body collisions (enemies can kill each other)
        game.enemies.forEach((otherEnemy, otherIndex) => {
          if (enemyIndex === otherIndex || enemiesToRemove.includes(otherIndex)) return;
          
          const otherHead = otherEnemy.segments[0];
          for (let i = 1; i < enemy.segments.length; i++) {
            if (checkCollision(otherHead, enemy.segments[i], SNAKE_SIZE + SNAKE_SIZE)) {
              // Other enemy dies - create food and stars (1 propia + las que comió)
              const deathX = otherHead.x;
              const deathY = otherHead.y;
              const enemyXP = otherEnemy.totalXP || (otherEnemy.length * 2);
              const starsToCreate = 1 + (otherEnemy.starsEaten || 0);
              createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
              createParticle(deathX, deathY, '#ff3366', 15);
              if (!enemiesToRemove.includes(otherIndex)) {
                enemiesToRemove.push(otherIndex);
              }
              break;
            }
          }
        });
      });

      // Remove dead enemies (in reverse order to maintain indices)
      enemiesToRemove.sort((a, b) => b - a).forEach(index => {
        game.enemies.splice(index, 1);
      });
      
      // Update bullets and check collisions
      const enemiesToKill = [];
      game.bullets = game.bullets.filter(bullet => {
        bullet.x += bullet.vx * normalizedDelta;
        bullet.y += bullet.vy * normalizedDelta;
        bullet.life -= normalizedDelta;
        
        // Check collision with enemies (player bullets)
        if (bullet.owner === 'player') {
        let hit = false;
          game.enemies.forEach((enemy, enemyIndex) => {
          if (!hit && enemy.segments.length > 0) {
              // Check collision with enemy head (most important)
              const enemyHead = enemy.segments[0];
              let hitEnemyHead = false;
              let hitEnemyBody = false;
              
              if (checkCollision(bullet, enemyHead, 15)) {
                hitEnemyHead = true;
              } else {
                // Check collision with enemy body
                for (let i = 1; i < enemy.segments.length; i++) {
                  if (checkCollision(bullet, enemy.segments[i], 12)) {
                    hitEnemyBody = true;
                    break;
                  }
                }
              }
              
              if (hitEnemyHead || hitEnemyBody) {
                // Sistema de vida: cabeza -2, cuerpo -1
                const damage = hitEnemyHead ? 2 : 1;
                enemy.currentHealth = (enemy.currentHealth || enemy.maxHealth) - damage;
                
                // Efecto visual según escudo
                const enemyShieldLevel = enemy.shieldLevel || 0;
                if (enemyShieldLevel > 0) {
                  createParticle(bullet.x, bullet.y, '#6495ed', 8); // Azul para escudo
                } else {
                  createParticle(bullet.x, bullet.y, '#ffff00', 8); // Amarillo normal
                }
                hit = true;
                
                // Si la vida llega a 0 o menos, el enemigo muere
                if (enemy.currentHealth <= 0) {
                  const deathX = enemyHead.x;
                  const deathY = enemyHead.y;
                  const enemyXP = enemy.totalXP || (enemy.length * 2);
                  const starsToCreate = 1 + (enemy.starsEaten || 0);
                  createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
                  createParticle(deathX, deathY, '#ff3366', 15);
                  enemiesToKill.push(enemyIndex);
                }
                return;
            }
          }
        });
        
          if (hit) return false; // Remove bullet if it hit
        }
        
        // Check collision with player (enemy and cannon bullets)
        if ((bullet.owner === 'enemy' || bullet.owner === 'cannon') && game.snake.length > 0) {
          const playerHead = game.snake[0];
          let hitHead = false;
          let hitBody = false;
          
          // Check head collision
          if (checkCollision(bullet, playerHead, 15)) {
            hitHead = true;
          } else {
            // Check body collision (all segments except head)
            for (let i = 1; i < game.snake.length; i++) {
              if (checkCollision(bullet, game.snake[i], 15)) {
                hitBody = true;
                break;
              }
            }
          }
          
          if (hitHead || hitBody) {
            // Sistema de escudo: probabilidad de esquivar
            // Nivel 2: 1 de 2 balas afectan (50% esquivar)
            // Nivel 3: 1 de 3 balas afectan (66.6% esquivar)
            // Nivel 10: 1 de 10 balas afectan (90% esquivar)
            let dodged = false;
            if (shieldLevel > 0) {
              const dodgeChance = (shieldLevel - 1) / shieldLevel;
              dodged = Math.random() < dodgeChance;
            }
            
            if (dodged) {
              // Esquivó el ataque - efecto visual azul brillante
              createParticle(bullet.x, bullet.y, '#00ffff', 12);
              return false; // Remove bullet sin hacer daño
            }
            
            // No esquivó - recibe daño con efectos visuales
            const damage = hitHead ? 2 : 1;
            const died = applyDamage(damage, bullet.x, bullet.y);
              
            // Si la vida llega a 0 o menos, el jugador muere
            if (died) {
                const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
                saveGameSession(game.sessionXP, level, game.sessionXP, duration);
                createParticle(playerHead.x, playerHead.y, '#ff3366', 20);
                setGameState('gameOver');
                return false;
            }
            
            return false; // Remove bullet
          }
        }
        
        return bullet.life > 0 &&
               bullet.x > 0 && bullet.x < game.worldWidth &&
               bullet.y > 0 && bullet.y < game.worldHeight;
      });
      
      // Remove killed enemies
      enemiesToKill.sort((a, b) => b - a).forEach(index => {
        game.enemies.splice(index, 1);
      });
      
      // Make enemies shoot - ahora con sistema de cannonLevel
      const currentTime = Date.now();
      game.enemies.forEach((enemy, enemyIndex) => {
        if (enemy.canShoot && enemy.segments.length > 0 && game.snake.length > 0) {
          // Check if cooldown has passed
          if (currentTime - enemy.lastShotTime >= enemy.shootCooldown) {
            const enemyHead = enemy.segments[0];
            const enemyTail = enemy.segments.length > 1 ? enemy.segments[enemy.segments.length - 1] : null;
            const playerHead = game.snake[0];
            
            // Calculate direction to player
            const dx = playerHead.x - enemyHead.x;
            const dy = playerHead.y - enemyHead.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only shoot if player is within range (500 units)
            if (distance < 500 && distance > 50) {
              const angle = Math.atan2(dy, dx);
              const perpAngle = angle + Math.PI / 2;
              const speed = 5;
              const cannonLevel = enemy.cannonLevel || 1;
              
              // Cannon configurations igual que el jugador:
              // Level 1: 1 bullet from head
              // Level 2: 2 bullets from head (double cannon)
              // Level 3: 2 bullets from head + 1 from tail
              // Level 4: 2 bullets from head + 2 from tail
              // Level 5: Same as 4 but faster
              
              // Disparos desde la cabeza
              const headBulletCount = cannonLevel >= 2 ? 2 : 1;
              for (let i = 0; i < headBulletCount; i++) {
                const offset = headBulletCount === 2 ? (i === 0 ? -10 : 10) : 0;
              game.bullets.push({
                  x: enemyHead.x + Math.cos(perpAngle) * offset,
                  y: enemyHead.y + Math.sin(perpAngle) * offset,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 120, // 2 seconds at 60fps
                owner: 'enemy'
              });
              }
              
              // Disparos desde la cola (nivel 3+)
              if (cannonLevel >= 3 && enemyTail) {
                const tailAngle = angle + Math.PI; // Dirección opuesta
                const tailPerpAngle = tailAngle + Math.PI / 2;
                const tailBulletCount = cannonLevel >= 4 ? 2 : 1;
                
                for (let i = 0; i < tailBulletCount; i++) {
                  const offset = tailBulletCount === 2 ? (i === 0 ? -10 : 10) : 0;
                  game.bullets.push({
                    x: enemyTail.x + Math.cos(tailPerpAngle) * offset,
                    y: enemyTail.y + Math.sin(tailPerpAngle) * offset,
                    vx: Math.cos(tailAngle) * speed,
                    vy: Math.sin(tailAngle) * speed,
                    life: 120,
                    owner: 'enemy'
                  });
                }
              }
              
              enemy.lastShotTime = currentTime;
              // Cooldown más rápido en nivel 5
              const baseCooldown = cannonLevel === 5 ? 1000 : 2000;
              enemy.shootCooldown = baseCooldown + Math.random() * 1500;
            }
          }
        }
      });
    };

    const update = (deltaTime) => {
      if (gameState !== 'playing' || shopOpen) return; // Pause when shop is open

      const game = gameRef.current;
      
      // Sistema de velocidad fija: siempre usar exactamente 1 frame de movimiento
      // Esto garantiza velocidad constante independiente del framerate
      const normalizedDelta = 1;
      
      // Check if player is passing through any opening
      if (game.centralRect && game.snake.length > 0) {
        const rect = game.centralRect;
        const headSize = game.snakeSize;
        
        // Helper to get opening position
        const getOpeningPos = (opening) => {
          if (opening.side === 'top' || opening.side === 'bottom') {
            return {
              x: rect.x + opening.position * (rect.width - opening.width),
              y: opening.side === 'top' ? rect.y : rect.y + rect.height - opening.height,
              width: opening.width,
              height: opening.height
            };
          } else {
            return {
              x: opening.side === 'left' ? rect.x : rect.x + rect.width - opening.width,
              y: rect.y + opening.position * (rect.height - opening.height),
              width: opening.width,
              height: opening.height
            };
          }
        };
        
        // Check each opening
        game.centralRect.openings.forEach(opening => {
          const openingPos = getOpeningPos(opening);
          let playerInOpening = false;
          
          // Check if any part of the snake is in the opening
          for (let i = 0; i < game.snake.length; i++) {
            const segment = game.snake[i];
            const segmentSize = i === 0 ? headSize : game.snakeSize;
            
            // Check if segment is within opening bounds
            if (segment.x + segmentSize > openingPos.x && 
                segment.x - segmentSize < openingPos.x + openingPos.width &&
                segment.y + segmentSize > openingPos.y && 
                segment.y - segmentSize < openingPos.y + openingPos.height) {
              playerInOpening = true;
              break;
            }
          }
          
          // Pause or resume opening movement
          if (playerInOpening) {
            opening.paused = true;
          } else {
            opening.paused = false;
          }
        });
      }
      
      // Update moving openings in central rectangle - bouncing movement (only if not paused)
      if (game.centralRect) {
        game.centralRect.openings.forEach(opening => {
          // Only move if not paused
          if (!opening.paused) {
            opening.position += opening.direction * opening.speed * normalizedDelta;
            
            // Bounce at edges
            if (opening.side === 'top' || opening.side === 'bottom') {
              const maxPosition = 1 - (opening.width / game.centralRect.width);
              if (opening.position <= 0) {
                opening.position = 0;
                opening.direction = 1; // Bounce right
              } else if (opening.position >= maxPosition) {
                opening.position = maxPosition;
                opening.direction = -1; // Bounce left
              }
            } else { // left or right
              const maxPosition = 1 - (opening.height / game.centralRect.height);
              if (opening.position <= 0) {
                opening.position = 0;
                opening.direction = 1; // Bounce down
              } else if (opening.position >= maxPosition) {
                opening.position = maxPosition;
                opening.direction = -1; // Bounce up
              }
            }
          }
        });
      }
      
      // Get head position (needed for both mobile and desktop)
      const head = game.snake.length > 0 ? game.snake[0] : { x: 0, y: 0 };
      
      // Use joystick direction on mobile, mouse position on desktop
      let targetDir = { x: 0, y: 0 };
      let distance = 0;
      
      // Check joystick state synchronously using ref
      const isJoystickActive = joystickRef.current.isActive;
      const joystickDir = joystickRef.current.direction;
      
      if (isMobile && isJoystickActive && (joystickDir.x !== 0 || joystickDir.y !== 0)) {
        // Mobile: use joystick direction directly from ref (synchronous)
        targetDir = {
          x: joystickDir.x,
          y: joystickDir.y
        };
        distance = 1; // Normalized direction, so distance is always 1
      } else if (!isMobile) {
        // Desktop: use mouse position
      const worldMouseX = game.mousePos.x + game.camera.x;
      const worldMouseY = game.mousePos.y + game.camera.y;
      
      const dx = worldMouseX - head.x;
      const dy = worldMouseY - head.y;
        distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) {
          targetDir = {
          x: dx / distance,
          y: dy / distance
        };
        }
      }
      
      // Apply speed based on input intensity
      let currentSpeed = game.baseSpeed;
      
      if (isMobile && isJoystickActive) {
        // Mobile: velocidad proporcional a qué tan lejos está el dedo del centro
        // Mínimo 30% de velocidad (cerca del centro), máximo 100% + bonus de speedLevel (en el borde)
        const joystickIntensity = joystickRef.current.intensity;
        const minSpeedFactor = 0.3; // 30% velocidad cuando está casi en el centro
        const maxSpeedFactor = 1.0 + (speedLevel * 0.1); // 100% + 10% por nivel de velocidad
        const speedFactor = minSpeedFactor + (maxSpeedFactor - minSpeedFactor) * joystickIntensity;
        currentSpeed = game.baseSpeed * speedFactor;
      } else if (!isMobile && speedLevel > 0 && distance < 200) {
        // Desktop: bonus de velocidad cuando el cursor está cerca
        const speedBonus = (speedLevel * 10) / 100; // 10% per level
        currentSpeed = game.baseSpeed * (1 + speedBonus);
      }
      game.speed = currentSpeed;
      
      // Smooth turning - interpolate between current and target direction
      if (distance > 0.1 || (isMobile && isJoystickActive)) {
        // Lerp factor for smooth turning - faster on mobile for better responsiveness
        const smoothFactor = isMobile ? 0.5 : 0.15; // Much faster response on mobile
        game.direction.x += (targetDir.x - game.direction.x) * smoothFactor;
        game.direction.y += (targetDir.y - game.direction.y) * smoothFactor;
        
        // Normalize to maintain constant speed
        const dirLength = Math.sqrt(game.direction.x * game.direction.x + game.direction.y * game.direction.y);
        if (dirLength > 0.01) {
        game.direction.x /= dirLength;
        game.direction.y /= dirLength;
        }
      }

      const newHead = {
        x: head.x + game.direction.x * game.speed * normalizedDelta,
        y: head.y + game.direction.y * game.speed * normalizedDelta
      };

      // Check collision with red borders - aplica daño con escudo
      if (newHead.x < BORDER_WIDTH || newHead.x > game.worldWidth - BORDER_WIDTH ||
          newHead.y < BORDER_WIDTH || newHead.y > game.worldHeight - BORDER_WIDTH) {
        
        // Sistema de escudo: probabilidad de esquivar
        let dodged = false;
        if (shieldLevel > 0) {
          const dodgeChance = (shieldLevel - 1) / shieldLevel;
          dodged = Math.random() < dodgeChance;
        }
        
        if (!dodged) {
          // No esquivó - recibe daño
          const damage = 5;
          game.currentHealth -= damage;
          
          // Efecto visual rojo
          createParticle(newHead.x, newHead.y, '#ff0000', 15);
          
          // Si la vida llega a 0, game over
          if (game.currentHealth <= 0) {
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(game.sessionXP || 0, level, game.sessionXP || 0, duration);
        setGameState('gameOver');
        return;
          }
        } else {
          // Esquivó - efecto visual azul brillante
          createParticle(newHead.x, newHead.y, '#00ffff', 15);
        }
        
        // Rebotar hacia el centro para no quedar pegado al borde (siempre)
        if (newHead.x < BORDER_WIDTH) newHead.x = BORDER_WIDTH + 5;
        if (newHead.x > game.worldWidth - BORDER_WIDTH) newHead.x = game.worldWidth - BORDER_WIDTH - 5;
        if (newHead.y < BORDER_WIDTH) newHead.y = BORDER_WIDTH + 5;
        if (newHead.y > game.worldHeight - BORDER_WIDTH) newHead.y = game.worldHeight - BORDER_WIDTH - 5;
      }

      // Check collision with central rectangle walls - instant death
      if (game.centralRect) {
        const rect = game.centralRect;
        const headX = newHead.x;
        const headY = newHead.y;
        const headSize = game.snakeSize;
        const wallThickness = 4;
        const collisionMargin = headSize + 2; // Small margin for collision detection
        
        // Helper to get opening position
        const getOpeningPos = (opening) => {
          if (opening.side === 'top' || opening.side === 'bottom') {
            return {
              x: rect.x + opening.position * (rect.width - opening.width),
              y: opening.side === 'top' ? rect.y : rect.y + rect.height - opening.height,
              width: opening.width,
              height: opening.height
            };
          } else {
            return {
              x: opening.side === 'left' ? rect.x : rect.x + rect.width - opening.width,
              y: rect.y + opening.position * (rect.height - opening.height),
              width: opening.width,
              height: opening.height
            };
          }
        };
        
        // Check collision with each wall - only if actually touching the wall
        // Top wall - check if Y is at the wall AND X is within the rectangle width
        if (headY >= rect.y - collisionMargin && headY <= rect.y + wallThickness + collisionMargin &&
            headX >= rect.x - collisionMargin && headX <= rect.x + rect.width + collisionMargin) {
          const topOpening = game.centralRect.openings.find(o => o.side === 'top');
          if (topOpening) {
            const opening = getOpeningPos(topOpening);
            // Check if head is NOT in the opening
            if (headX < opening.x - collisionMargin || headX > opening.x + opening.width + collisionMargin) {
              // Hit the wall, not the opening
              const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
              saveGameSession(game.sessionXP, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            // No opening, always die if touching wall
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            setGameState('gameOver');
            return;
          }
        }
        
        // Bottom wall
        if (headY >= rect.y + rect.height - wallThickness - collisionMargin && headY <= rect.y + rect.height + collisionMargin &&
            headX >= rect.x - collisionMargin && headX <= rect.x + rect.width + collisionMargin) {
          const bottomOpening = game.centralRect.openings.find(o => o.side === 'bottom');
          if (bottomOpening) {
            const opening = getOpeningPos(bottomOpening);
            if (headX < opening.x - collisionMargin || headX > opening.x + opening.width + collisionMargin) {
              const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
              saveGameSession(game.sessionXP, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            setGameState('gameOver');
            return;
          }
        }
        
        // Left wall - check if X is at the wall AND Y is within the rectangle height
        if (headX >= rect.x - collisionMargin && headX <= rect.x + wallThickness + collisionMargin &&
            headY >= rect.y - collisionMargin && headY <= rect.y + rect.height + collisionMargin) {
          const leftOpening = game.centralRect.openings.find(o => o.side === 'left');
          if (leftOpening) {
            const opening = getOpeningPos(leftOpening);
            if (headY < opening.y - collisionMargin || headY > opening.y + opening.height + collisionMargin) {
              const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
              saveGameSession(game.sessionXP, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            setGameState('gameOver');
            return;
          }
        }
        
        // Right wall
        if (headX >= rect.x + rect.width - wallThickness - collisionMargin && headX <= rect.x + rect.width + collisionMargin &&
            headY >= rect.y - collisionMargin && headY <= rect.y + rect.height + collisionMargin) {
          const rightOpening = game.centralRect.openings.find(o => o.side === 'right');
          if (rightOpening) {
            const opening = getOpeningPos(rightOpening);
            if (headY < opening.y - collisionMargin || headY > opening.y + opening.height + collisionMargin) {
              const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
              saveGameSession(game.sessionXP, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            setGameState('gameOver');
            return;
          }
        }
      }

      game.snake.unshift(newHead);

      // Update camera to follow player
      game.camera.x = Math.max(0, Math.min(game.worldWidth - CANVAS_WIDTH, newHead.x - CANVAS_WIDTH / 2));
      game.camera.y = Math.max(0, Math.min(game.worldHeight - CANVAS_HEIGHT, newHead.y - CANVAS_HEIGHT / 2));

      // Apply magnet improvement to attract food towards snake HEAD
      // magnetLevel 1-10: rango 25, 50, 75... 250 pixels desde la cabeza
      const currentMagnetLevel = game.magnetLevel || 0;
      if (currentMagnetLevel > 0) {
        const magnetRange = 25 * currentMagnetLevel; // 25px por nivel
        const head = game.snake[0];
        
        // Atraer comida hacia la cabeza
        game.food.forEach(food => {
          const dx = head.x - food.x;
          const dy = head.y - food.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < magnetRange && distance > 0) {
            const attractionStrength = (1 - distance / magnetRange) * 3.0;
            food.x += (dx / distance) * attractionStrength;
            food.y += (dy / distance) * attractionStrength;
          }
        });
        
        // También atraer estrellas
        if (game.stars) {
          game.stars.forEach(star => {
            const dx = head.x - star.x;
            const dy = head.y - star.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < magnetRange && distance > 0) {
              const attractionStrength = (1 - distance / magnetRange) * 3.0;
              star.x += (dx / distance) * attractionStrength;
              star.y += (dy / distance) * attractionStrength;
            }
          });
        }
      }

      // Check food collision
      let foodEaten = false;
      const levelConfig = getLevelConfig(game.level, levelConfigs);
      game.food = game.food.filter(food => {
        if (checkCollision(newHead, food, game.snakeSize + food.size)) {
          // Head levels: 1 = normal (1x), 2 = double (2x), 3 = triple (3x)
          const xpMultiplier = headLevel;
          const xpGain = food.value * xpMultiplier;
          game.currentXP += xpGain;
          game.sessionXP += xpGain;
          setCurrentLevelXP(prev => prev + xpGain);
          setTotalXP(prev => prev + xpGain);
          setScore(prev => prev + xpGain); // Update score
          
          // El tamaño NO cambia al comer - solo crece la cola
          // game.snakeSize se mantiene constante
          
          createParticle(food.x, food.y, food.color, 5);
          foodEaten = true;
          
          // Reaparecer otro punto XP en otro lugar del mapa
          const newFood = createFood();
          game.food.push(newFood);
          
          return false;
        }
        return true;
      });

      // Check star collision
      let starCollected = false;
      game.stars = game.stars.filter(star => {
        if (checkCollision(newHead, star, game.snakeSize + star.size)) {
          // Collect star
          game.currentStars += 1;
          setCurrentLevelStars(prev => prev + 1);
          setTotalStars(prev => prev + 1);
          
          // Recuperar vida SOLO si este grupo de estrellas no ha curado todavía
          // (máximo 1 vida por víbora muerta, sin importar cuántas estrellas tenía)
          if (star.groupId) {
            // Estrella de víbora muerta - verificar si el grupo ya curó
            const groupAlreadyHealed = game.stars.some(s => s.groupId === star.groupId && s.healedAlready);
            
            if (!groupAlreadyHealed) {
              // Primera estrella del grupo - curar 1 vida y marcar el grupo
              applyHeal(1, star.x, star.y);
              // Marcar todas las estrellas del mismo grupo como que ya curaron
              game.stars.forEach(s => {
                if (s.groupId === star.groupId) {
                  s.healedAlready = true;
                }
              });
            }
            // Si el grupo ya curó, no cura pero sí cuenta la estrella
          } else {
            // Estrella sin grupo (del mapa o spawn inicial) - cura normalmente
            applyHeal(1, star.x, star.y);
          }
          
          createParticle(star.x, star.y, '#FFD700', 8);
          starCollected = true;
          return false; // Remove star
        }
        return true; // Keep star
      });

      if (foodEaten) {
        // Grow snake
        for (let i = 0; i < 3; i++) {
          game.snake.push({ ...game.snake[game.snake.length - 1] });
        }
      } else {
        game.snake.pop();
      }

      // Add new food if needed - mantener cantidad inicial constante
      const targetFoodCount = game.initialFoodCount || getLevelConfig(game.level, levelConfigs).xpDensity;
      while (game.food.length < targetFoodCount) {
        game.food.push(createFood());
      }

      // Check level completion - based on stars now
      if (game.currentStars >= game.starsNeeded) {
        // Save game session when completing level
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
        saveGameSession(game.sessionXP, level, game.sessionXP, duration);
        
        // Si es el nivel 25, mostrar pantalla especial de victoria
        if (level === 25) {
          // Obtener datos del ranking del usuario
          fetch(`/api/leaderboard/rank/${user.id}`)
            .then(res => res.json())
            .then(data => {
              const previousBestScore = data.bestScore || 0;
              
              setVictoryData({
                score: game.sessionXP,
                previousBestScore: previousBestScore,
                position: data.rank || '?',
                isNewRecord: game.sessionXP > previousBestScore,
                series: currentSeries
              });
              setGameState('gameComplete');
            })
            .catch(err => {
              console.error('Error obteniendo ranking:', err);
              // Fallback si falla el endpoint
              setVictoryData({
                score: game.sessionXP,
                previousBestScore: 0,
                position: '?',
                isNewRecord: true,
                series: currentSeries
              });
              setGameState('gameComplete');
            });
        } else {
        setGameState('levelComplete');
        }
      }

      updateEnemies(normalizedDelta);

      // Update Killer Saws
      if (game.killerSaws && game.killerSaws.length > 0) {
        game.killerSaws.forEach(saw => {
          // Rotate
          saw.rotation += saw.rotationSpeed * normalizedDelta;
          
          // Move
          saw.x += saw.velocity.x * saw.speed * normalizedDelta;
          saw.y += saw.velocity.y * saw.speed * normalizedDelta;
          
          // Bounce off walls
          if (saw.x - saw.radius < BORDER_WIDTH || saw.x + saw.radius > game.worldWidth - BORDER_WIDTH) {
            saw.velocity.x *= -1;
            saw.x = Math.max(BORDER_WIDTH + saw.radius, Math.min(game.worldWidth - BORDER_WIDTH - saw.radius, saw.x));
          }
          if (saw.y - saw.radius < BORDER_WIDTH || saw.y + saw.radius > game.worldHeight - BORDER_WIDTH) {
            saw.velocity.y *= -1;
            saw.y = Math.max(BORDER_WIDTH + saw.radius, Math.min(game.worldHeight - BORDER_WIDTH - saw.radius, saw.y));
          }
          
          // Check collision with player
          const head = game.snake[0];
          if (head) {
            const dx = head.x - saw.x;
            const dy = head.y - saw.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const collisionDist = saw.radius + game.snakeSize + 5; // Extra margen para mejor detección
            
            if (dist < collisionDist) {
              // Player hit by saw! - empujar siempre para evitar quedarse pegado
              const pushForce = 50;
              if (dist > 0) {
                head.x += (dx / dist) * pushForce;
                head.y += (dy / dist) * pushForce;
              }
              
              // Daño variable según tamaño/color de la sierra (1-5)
              // El escudo NO protege contra las sierras
              const damage = saw.damage || 1;
              
              if (damage > 0) {
                const died = applyDamage(damage, head.x, head.y);
                if (died) {
                  const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
                  saveGameSession(game.sessionXP || 0, level, game.sessionXP || 0, duration);
                  setGameState('gameOver');
                  return;
                }
              }
            }
          }
        });
      }

      // Update Floating Cannons
      if (game.floatingCannons && game.floatingCannons.length > 0) {
        const currentTime = Date.now();
        game.floatingCannons.forEach(cannon => {
          // Apuntar a un segmento aleatorio del cuerpo de la víbora (no solo la cabeza)
          if (game.snake.length > 0) {
            // Elegir un segmento aleatorio como objetivo (cabeza o cuerpo)
            const targetIndex = Math.floor(Math.random() * Math.min(game.snake.length, 10)); // Máximo los primeros 10 segmentos
            const target = game.snake[targetIndex];
            
            const dx = target.x - cannon.x;
            const dy = target.y - cannon.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Only aim if player is in range
            if (dist < cannon.range) {
              const targetAngle = Math.atan2(dy, dx);
              // Smooth rotation towards target
              const angleDiff = targetAngle - cannon.angle;
              cannon.angle += angleDiff * 0.08 * normalizedDelta; // Rotación más rápida
              
              // Shoot if cooldown is ready (2 disparos por segundo = 500ms)
              const shootInterval = 500; // 500ms = 2 disparos por segundo
              if (currentTime - cannon.shootCooldown > shootInterval) {
                cannon.shootCooldown = currentTime;
                
                // Crear DOBLE BALA (separadas ligeramente)
                const spreadAngle = 0.15; // Separación entre las dos balas
                
                // Bala 1
                game.bullets.push({
                  x: cannon.x + Math.cos(cannon.angle - spreadAngle) * 35,
                  y: cannon.y + Math.sin(cannon.angle - spreadAngle) * 35,
                  vx: Math.cos(cannon.angle - spreadAngle) * cannon.bulletSpeed,
                  vy: Math.sin(cannon.angle - spreadAngle) * cannon.bulletSpeed,
                  life: 150,
                  owner: 'cannon'
                });
                
                // Bala 2
                game.bullets.push({
                  x: cannon.x + Math.cos(cannon.angle + spreadAngle) * 35,
                  y: cannon.y + Math.sin(cannon.angle + spreadAngle) * 35,
                  vx: Math.cos(cannon.angle + spreadAngle) * cannon.bulletSpeed,
                  vy: Math.sin(cannon.angle + spreadAngle) * cannon.bulletSpeed,
                  life: 150,
                  owner: 'cannon'
                });
              }
            }
          }
        });
      }

      // Update Resentful Snakes
      if (game.resentfulSnakes && game.resentfulSnakes.length > 0) {
        const currentTime = Date.now();
        game.resentfulSnakes.forEach(snake => {
          if (!snake.segments || snake.segments.length === 0) return;
          
          const snakeHead = snake.segments[0];
          const playerHead = game.snake[0];
          
          if (playerHead) {
            const dx = playerHead.x - snakeHead.x;
            const dy = playerHead.y - snakeHead.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Chase player if in range
            if (dist < snake.chaseRange) {
              // Aim at player
              const targetDir = { x: dx / dist, y: dy / dist };
              
              // Smooth turning
              snake.direction.x += (targetDir.x - snake.direction.x) * 0.1 * normalizedDelta;
              snake.direction.y += (targetDir.y - snake.direction.y) * 0.1 * normalizedDelta;
              
              // Normalize
              const dirLen = Math.sqrt(snake.direction.x * snake.direction.x + snake.direction.y * snake.direction.y);
              if (dirLen > 0) {
                snake.direction.x /= dirLen;
                snake.direction.y /= dirLen;
              }
              
              // Shoot at player
              if (currentTime - snake.lastShotTime > snake.shootCooldown) {
                snake.lastShotTime = currentTime;
                game.bullets.push({
                  x: snakeHead.x + snake.direction.x * 15,
                  y: snakeHead.y + snake.direction.y * 15,
                  vx: snake.direction.x * 6,
                  vy: snake.direction.y * 6,
                  life: 100,
                  owner: 'enemy'
                });
              }
            } else {
              // Random movement when not chasing
              if (Math.random() < 0.02 * normalizedDelta) {
                snake.direction = {
                  x: Math.cos(Math.random() * Math.PI * 2),
                  y: Math.sin(Math.random() * Math.PI * 2)
                };
              }
            }
            
            // Move snake
            const newX = snakeHead.x + snake.direction.x * snake.speed * normalizedDelta;
            const newY = snakeHead.y + snake.direction.y * snake.speed * normalizedDelta;
            
            // Bounce off walls
            if (newX > BORDER_WIDTH && newX < game.worldWidth - BORDER_WIDTH &&
                newY > BORDER_WIDTH && newY < game.worldHeight - BORDER_WIDTH) {
              snake.segments.unshift({ x: newX, y: newY });
              
              // Maintain length
              while (snake.segments.length > snake.length) {
                snake.segments.pop();
              }
            } else {
              // Bounce
              if (newX <= BORDER_WIDTH || newX >= game.worldWidth - BORDER_WIDTH) {
                snake.direction.x *= -1;
              }
              if (newY <= BORDER_WIDTH || newY >= game.worldHeight - BORDER_WIDTH) {
                snake.direction.y *= -1;
              }
            }
            
            // Check collision with player
            if (dist < game.snakeSize * 2) {
              // Player hit by resentful snake! - Empujar al jugador
              const pushForce = 40;
              if (dist > 0) {
                playerHead.x += (dx / dist) * pushForce;
                playerHead.y += (dy / dist) * pushForce;
              }
              
              let damage = 3;
              
              if (shieldLevel >= 4) {
                damage = 0; // Full protection
              } else if (shieldLevel >= 1) {
                damage = Math.ceil(damage / 2);
              }
              
              if (damage > 0) {
                const died = applyDamage(damage, playerHead.x, playerHead.y);
                
                // ¡CORTAR LA VÍBORA! - Quitar segmentos según el daño
                if (game.snake.length > 1) {
                  const segmentsToCut = Math.min(damage * 3, game.snake.length - 1); // Cortar 3 segmentos por punto de daño
                  for (let cut = 0; cut < segmentsToCut; cut++) {
                    const removedSegment = game.snake.pop();
                    if (removedSegment) {
                      // Crear partículas rojas donde se cortó
                      createParticle(removedSegment.x, removedSegment.y, '#ff3366', 5);
                    }
                  }
                }
                
                if (died) {
                  const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
                  saveGameSession(game.sessionXP || 0, level, game.sessionXP || 0, duration);
                  setGameState('gameOver');
                  return;
                }
              }
            }
          }
        });
      }

      // Update Health Boxes
      if (game.healthBoxes && game.healthBoxes.length > 0) {
        game.healthBoxes = game.healthBoxes.filter(box => {
          // Animate pulse
          box.pulse += box.pulseSpeed * normalizedDelta;
          
          // Check collision with player
          const head = game.snake[0];
          if (head) {
            const dx = head.x - box.x;
            const dy = head.y - box.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < box.size + game.snakeSize) {
              // Collect health box!
              applyHeal(box.healthPoints, box.x, box.y);
              return false; // Remove health box
            }
          }
          return true;
        });
      }

      // Update visual effect timers
      if (game.damageFlash > 0) game.damageFlash -= normalizedDelta;
      if (game.healFlash > 0) game.healFlash -= normalizedDelta;
      if (game.invulnerable > 0) game.invulnerable -= normalizedDelta;

      // Update particles
      game.particles = game.particles.filter(p => {
        p.x += p.vx * normalizedDelta;
        p.y += p.vy * normalizedDelta;
        p.life -= 0.02 * normalizedDelta;
        return p.life > 0;
      });
    };

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const game = gameRef.current;
      const camX = game.camera.x;
      const camY = game.camera.y;

      // Draw grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      const startX = Math.floor(camX / 40) * 40;
      const startY = Math.floor(camY / 40) * 40;
      for (let i = startX; i < camX + CANVAS_WIDTH; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i - camX, 0);
        ctx.lineTo(i - camX, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let i = startY; i < camY + CANVAS_HEIGHT; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i - camY);
        ctx.lineTo(CANVAS_WIDTH, i - camY);
        ctx.stroke();
      }

      // Draw world borders in RED
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = BORDER_WIDTH;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff0000';
      
      // Top border
      if (camY < BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(0 - camX, BORDER_WIDTH / 2 - camY);
        ctx.lineTo(game.worldWidth - camX, BORDER_WIDTH / 2 - camY);
        ctx.stroke();
      }
      
      // Bottom border
      if (camY + CANVAS_HEIGHT > game.worldHeight - BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(0 - camX, game.worldHeight - BORDER_WIDTH / 2 - camY);
        ctx.lineTo(game.worldWidth - camX, game.worldHeight - BORDER_WIDTH / 2 - camY);
        ctx.stroke();
      }
      
      // Left border
      if (camX < BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(BORDER_WIDTH / 2 - camX, 0 - camY);
        ctx.lineTo(BORDER_WIDTH / 2 - camX, game.worldHeight - camY);
        ctx.stroke();
      }
      
      // Right border
      if (camX + CANVAS_WIDTH > game.worldWidth - BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(game.worldWidth - BORDER_WIDTH / 2 - camX, 0 - camY);
        ctx.lineTo(game.worldWidth - BORDER_WIDTH / 2 - camX, game.worldHeight - camY);
        ctx.stroke();
      }
      
      ctx.shadowBlur = 0;

      // Draw central rectangle with moving openings
      if (game.centralRect) {
        const rect = game.centralRect;
        const rectX = rect.x - camX;
        const rectY = rect.y - camY;
        
        // Draw walls as red lines (like borders) - only visible parts
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        
        // Calculate opening positions
        const openingRects = rect.openings.map(opening => {
          let x, y, width, height;
          
          if (opening.side === 'top') {
            x = rect.x + opening.position * (rect.width - opening.width);
            y = rect.y;
            width = opening.width;
            height = opening.height;
          } else if (opening.side === 'bottom') {
            x = rect.x + opening.position * (rect.width - opening.width);
            y = rect.y + rect.height - opening.height;
            width = opening.width;
            height = opening.height;
          } else if (opening.side === 'left') {
            x = rect.x;
            y = rect.y + opening.position * (rect.height - opening.height);
            width = opening.width;
            height = opening.height;
          } else { // right
            x = rect.x + rect.width - opening.width;
            y = rect.y + opening.position * (rect.height - opening.height);
            width = opening.width;
            height = opening.height;
          }
          
          return { x, y, width, height, side: opening.side };
        });
        
        // Draw top wall (with opening gap)
        const topOpening = openingRects.find(o => o.side === 'top');
        if (topOpening) {
          // Left segment
          if (topOpening.x > rect.x) {
            ctx.beginPath();
            ctx.moveTo(rectX, rectY);
            ctx.lineTo(rectX + (topOpening.x - rect.x), rectY);
            ctx.stroke();
          }
          // Right segment
          if (topOpening.x + topOpening.width < rect.x + rect.width) {
            ctx.beginPath();
            ctx.moveTo(rectX + (topOpening.x + topOpening.width - rect.x), rectY);
            ctx.lineTo(rectX + rect.width, rectY);
            ctx.stroke();
          }
        } else {
          // Full top wall
          ctx.beginPath();
          ctx.moveTo(rectX, rectY);
          ctx.lineTo(rectX + rect.width, rectY);
          ctx.stroke();
        }
        
        // Draw bottom wall (with opening gap)
        const bottomOpening = openingRects.find(o => o.side === 'bottom');
        if (bottomOpening) {
          // Left segment
          if (bottomOpening.x > rect.x) {
            ctx.beginPath();
            ctx.moveTo(rectX, rectY + rect.height);
            ctx.lineTo(rectX + (bottomOpening.x - rect.x), rectY + rect.height);
            ctx.stroke();
          }
          // Right segment
          if (bottomOpening.x + bottomOpening.width < rect.x + rect.width) {
            ctx.beginPath();
            ctx.moveTo(rectX + (bottomOpening.x + bottomOpening.width - rect.x), rectY + rect.height);
            ctx.lineTo(rectX + rect.width, rectY + rect.height);
            ctx.stroke();
          }
        } else {
          // Full bottom wall
          ctx.beginPath();
          ctx.moveTo(rectX, rectY + rect.height);
          ctx.lineTo(rectX + rect.width, rectY + rect.height);
          ctx.stroke();
        }
        
        // Draw left wall (with opening gap)
        const leftOpening = openingRects.find(o => o.side === 'left');
        if (leftOpening) {
          // Top segment
          if (leftOpening.y > rect.y) {
            ctx.beginPath();
            ctx.moveTo(rectX, rectY);
            ctx.lineTo(rectX, rectY + (leftOpening.y - rect.y));
            ctx.stroke();
          }
          // Bottom segment
          if (leftOpening.y + leftOpening.height < rect.y + rect.height) {
            ctx.beginPath();
            ctx.moveTo(rectX, rectY + (leftOpening.y + leftOpening.height - rect.y));
            ctx.lineTo(rectX, rectY + rect.height);
            ctx.stroke();
          }
        } else {
          // Full left wall
          ctx.beginPath();
          ctx.moveTo(rectX, rectY);
          ctx.lineTo(rectX, rectY + rect.height);
          ctx.stroke();
        }
        
        // Draw right wall (with opening gap)
        const rightOpening = openingRects.find(o => o.side === 'right');
        if (rightOpening) {
          // Top segment
          if (rightOpening.y > rect.y) {
            ctx.beginPath();
            ctx.moveTo(rectX + rect.width, rectY);
            ctx.lineTo(rectX + rect.width, rectY + (rightOpening.y - rect.y));
            ctx.stroke();
          }
          // Bottom segment
          if (rightOpening.y + rightOpening.height < rect.y + rect.height) {
            ctx.beginPath();
            ctx.moveTo(rectX + rect.width, rectY + (rightOpening.y + rightOpening.height - rect.y));
            ctx.lineTo(rectX + rect.width, rectY + rect.height);
            ctx.stroke();
          }
        } else {
          // Full right wall
          ctx.beginPath();
          ctx.moveTo(rectX + rect.width, rectY);
          ctx.lineTo(rectX + rect.width, rectY + rect.height);
          ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
      }

      // Draw food with rainbow colors and variable sizes
      game.food.forEach(food => {
        const screenX = food.x - camX;
        const screenY = food.y - camY;
        
        // Only draw if visible on screen
        if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
            screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
          // Glow effect
          const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, food.size * 3);
          const alpha = 0.3 + Math.sin(Date.now() / 200 + food.x) * 0.2;
          glow.addColorStop(0, `hsla(${food.hue}, 100%, 50%, ${alpha})`);
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(screenX - food.size * 3, screenY - food.size * 3, food.size * 6, food.size * 6);
          
          // The orb itself
          ctx.fillStyle = food.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = food.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, food.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw stars (golden 5-pointed stars)
      game.stars.forEach(star => {
        // Update star animation
        star.rotation += star.rotationSpeed;
        star.pulse += star.pulseSpeed;
        
        const screenX = star.x - camX;
        const screenY = star.y - camY;
        
        // Only draw if visible on screen
        if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
            screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
          const pulseSize = star.size + Math.sin(star.pulse) * 3;
          const glowAlpha = 0.4 + Math.sin(star.pulse) * 0.3;
          
          // Outer glow
          const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, pulseSize * 2);
          glow.addColorStop(0, `rgba(255, 215, 0, ${glowAlpha})`);
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(screenX - pulseSize * 2, screenY - pulseSize * 2, pulseSize * 4, pulseSize * 4);
          
          // Draw the star
          ctx.fillStyle = '#FFD700';
          ctx.strokeStyle = '#FFA500';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#FFD700';
          drawStar(ctx, screenX, screenY, pulseSize, star.rotation);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      // Draw enemies
      if (!game.enemies || game.enemies.length === 0) {
        console.warn('⚠️ No hay enemigos para dibujar');
      }
      game.enemies.forEach(enemy => {
        if (!enemy.segments || enemy.segments.length === 0) {
          console.warn('⚠️ Enemigo sin segmentos:', enemy);
          return;
        }
        enemy.segments.forEach((seg, i) => {
          const screenX = seg.x - camX;
          const screenY = seg.y - camY;
          
          if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
              screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
            const alpha = 1 - (i / enemy.segments.length) * 0.5;
            
            // Dibujar escudo si el enemigo lo tiene (solo en la cabeza)
            if (enemy.hasShield && i === 0) {
              const shieldAlpha = alpha * 0.4;
              ctx.strokeStyle = `rgba(100, 149, 237, ${shieldAlpha})`;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(screenX, screenY, SNAKE_SIZE + 4, 0, Math.PI * 2);
              ctx.stroke();
            }
            
            ctx.fillStyle = `hsla(${enemy.hue}, 100%, 50%, ${alpha})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = `hsl(${enemy.hue}, 100%, 50%)`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, SNAKE_SIZE, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.shadowBlur = 0;
      });

      // Draw player snake with rainbow gradient like the logo
      const snakeColors = [
        { r: 0, g: 255, b: 0 },      // Verde brillante
        { r: 128, g: 255, b: 0 },    // Verde-amarillo
        { r: 255, g: 255, b: 0 },    // Amarillo
        { r: 255, g: 200, b: 0 },    // Amarillo-naranja
        { r: 255, g: 136, b: 0 },    // Naranja
        { r: 255, g: 100, b: 100 },  // Naranja-rosa
        { r: 255, g: 0, b: 255 }     // Rosa/Magenta
      ];
      
      // Dibujar víbora (sin parpadeo para evitar lag)
      game.snake.forEach((seg, i) => {
        const screenX = seg.x - camX;
        const screenY = seg.y - camY;
        let alpha = 1 - (i / game.snake.length) * 0.2;
        
        // Calculate color based on position in snake (gradient)
        const colorProgress = Math.min(i / Math.max(game.snake.length - 1, 1), 1);
        const colorIndex = colorProgress * (snakeColors.length - 1);
        const colorLow = Math.floor(colorIndex);
        const colorHigh = Math.min(colorLow + 1, snakeColors.length - 1);
        const colorMix = colorIndex - colorLow;
        
        let r = Math.round(snakeColors[colorLow].r + (snakeColors[colorHigh].r - snakeColors[colorLow].r) * colorMix);
        let g = Math.round(snakeColors[colorLow].g + (snakeColors[colorHigh].g - snakeColors[colorLow].g) * colorMix);
        let b = Math.round(snakeColors[colorLow].b + (snakeColors[colorHigh].b - snakeColors[colorLow].b) * colorMix);
        
        // Apply damage flash (red tint)
        if (game.damageFlash > 0) {
          const flashIntensity = game.damageFlash / 30;
          r = Math.min(255, r + Math.round(100 * flashIntensity));
          g = Math.round(g * (1 - flashIntensity * 0.5));
          b = Math.round(b * (1 - flashIntensity * 0.5));
        }
        
        // Apply heal flash (green tint)
        if (game.healFlash > 0) {
          const healIntensity = game.healFlash / 20;
          g = Math.min(255, g + Math.round(100 * healIntensity));
        }
        
        const segmentColor = `rgb(${r}, ${g}, ${b})`;
        
        // Shield visual effects
        if (shieldLevel > 0 && i < 5) {
          const shieldAlpha = shieldLevel === 1 ? 0.3 : 0.6;
          ctx.strokeStyle = `rgba(100, 150, 255, ${alpha * shieldAlpha})`;
          ctx.lineWidth = shieldLevel === 1 ? 3 : 5;
          ctx.beginPath();
          ctx.arc(screenX, screenY, game.snakeSize + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw segment with gradient color
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.shadowBlur = game.damageFlash > 0 ? 20 : (game.healFlash > 0 ? 18 : 12);
        ctx.shadowColor = game.damageFlash > 0 ? '#ff0000' : (game.healFlash > 0 ? '#00ff00' : segmentColor);
        ctx.beginPath();
        ctx.arc(screenX, screenY, game.snakeSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw eyes on the head (segment 0)
        if (i === 0) {
          ctx.shadowBlur = 0;
          
          // Calculate eye positions based on direction
          const dir = game.direction;
          
          // Ojos más grandes y visibles - tamaño fijo que no depende del snakeSize
          const eyeOffset = 5;  // Separación entre ojos
          const eyeRadius = 4;  // Tamaño del ojo blanco
          const pupilRadius = 2; // Tamaño de la pupila
          
          // Perpendicular direction for eye placement
          const perpX = -dir.y;
          const perpY = dir.x;
          
          // Posición de los ojos más hacia adelante
          const forwardOffset = 3;
          
          // Left eye position
          const leftEyeX = screenX + perpX * eyeOffset + dir.x * forwardOffset;
          const leftEyeY = screenY + perpY * eyeOffset + dir.y * forwardOffset;
          
          // Right eye position  
          const rightEyeX = screenX - perpX * eyeOffset + dir.x * forwardOffset;
          const rightEyeY = screenY - perpY * eyeOffset + dir.y * forwardOffset;
          
          // Draw white part of eyes with glow
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ffffff';
          
          ctx.beginPath();
          ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw pupils (looking in movement direction)
          ctx.fillStyle = '#000000';
          ctx.shadowBlur = 0;
          
          const pupilOffsetX = dir.x * 1.5;
          const pupilOffsetY = dir.y * 1.5;
          
          ctx.beginPath();
          ctx.arc(leftEyeX + pupilOffsetX, leftEyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(rightEyeX + pupilOffsetX, rightEyeY + pupilOffsetY, pupilRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.shadowBlur = 0;

      // Draw bullets
      game.bullets.forEach(bullet => {
        const screenX = bullet.x - camX;
        const screenY = bullet.y - camY;
        
        // Different colors for player vs enemy bullets
        if (bullet.owner === 'player') {
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        } else {
          ctx.fillStyle = '#ff0000';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff0000';
        }
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw particles
      game.particles.forEach(p => {
        const screenX = p.x - camX;
        const screenY = p.y - camY;
        ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Draw Killer Saws
      if (game.killerSaws && game.killerSaws.length > 0) {
        game.killerSaws.forEach(saw => {
          const screenX = saw.x - camX;
          const screenY = saw.y - camY;
          
          if (screenX > -100 && screenX < CANVAS_WIDTH + 100 && 
              screenY > -100 && screenY < CANVAS_HEIGHT + 100) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(saw.rotation);
            
            // Outer glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = saw.color;
            
            // Draw saw body
            ctx.fillStyle = saw.color;
            ctx.beginPath();
            ctx.arc(0, 0, saw.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw saw teeth
            const teethCount = 12;
            ctx.fillStyle = '#333';
            for (let i = 0; i < teethCount; i++) {
              const angle = (Math.PI * 2 * i) / teethCount;
              ctx.beginPath();
              ctx.moveTo(Math.cos(angle) * saw.radius * 0.5, Math.sin(angle) * saw.radius * 0.5);
              ctx.lineTo(Math.cos(angle + 0.15) * saw.radius * 1.1, Math.sin(angle + 0.15) * saw.radius * 1.1);
              ctx.lineTo(Math.cos(angle - 0.15) * saw.radius * 1.1, Math.sin(angle - 0.15) * saw.radius * 1.1);
              ctx.closePath();
              ctx.fill();
            }
            
            // Center circle
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(0, 0, saw.radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            ctx.shadowBlur = 0;
          }
        });
      }

      // Draw Floating Cannons
      if (game.floatingCannons && game.floatingCannons.length > 0) {
        game.floatingCannons.forEach(cannon => {
          const screenX = cannon.x - camX;
          const screenY = cannon.y - camY;
          
          if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
              screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(cannon.angle);
            
            // Cannon body
            ctx.fillStyle = '#555';
      ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff6600';
      ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
            
            // Cannon barrel
            ctx.fillStyle = '#333';
            ctx.fillRect(10, -5, 25, 10);
            
            // Cannon glow indicator
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
      ctx.shadowBlur = 0;
          }
        });
      }

      // Draw Resentful Snakes (special red enemies that chase player)
      if (game.resentfulSnakes && game.resentfulSnakes.length > 0) {
        game.resentfulSnakes.forEach(snake => {
          if (!snake.segments || snake.segments.length === 0) return;
          
          snake.segments.forEach((seg, i) => {
            const screenX = seg.x - camX;
            const screenY = seg.y - camY;
            
            if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
                screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
              const alpha = 1 - (i / snake.segments.length) * 0.5;
              
              // Red color for resentful snakes
              ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
              ctx.shadowBlur = 15;
              ctx.shadowColor = '#ff0000';
              ctx.beginPath();
              ctx.arc(screenX, screenY, SNAKE_SIZE, 0, Math.PI * 2);
              ctx.fill();
              
              // Angry eyes on head
              if (i === 0) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(screenX - 3, screenY - 2, 3, 0, Math.PI * 2);
                ctx.arc(screenX + 3, screenY - 2, 3, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(screenX - 3, screenY - 2, 1.5, 0, Math.PI * 2);
                ctx.arc(screenX + 3, screenY - 2, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          });
          ctx.shadowBlur = 0;
        });
      }

      // Draw Health Boxes
      if (game.healthBoxes && game.healthBoxes.length > 0) {
        game.healthBoxes.forEach(box => {
          const screenX = box.x - camX;
          const screenY = box.y - camY;
          
          if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
              screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
            const pulseSize = box.size + Math.sin(box.pulse) * 3;
            
            // Glow effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ff00';
            
            // Box body
            ctx.fillStyle = '#00aa00';
            ctx.fillRect(screenX - pulseSize/2, screenY - pulseSize/2, pulseSize, pulseSize);
            
            // White cross
            ctx.fillStyle = '#ffffff';
            const crossWidth = pulseSize * 0.25;
            const crossLength = pulseSize * 0.7;
            ctx.fillRect(screenX - crossWidth/2, screenY - crossLength/2, crossWidth, crossLength);
            ctx.fillRect(screenX - crossLength/2, screenY - crossWidth/2, crossLength, crossWidth);
            
            // Health points indicator
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(`+${box.healthPoints}`, screenX, screenY + pulseSize/2 + 15);
            ctx.textAlign = 'left';
            
            ctx.shadowBlur = 0;
          }
        });
      }

      // Draw HUD - Horizontal level bar at the top (compact)
      const barHeight = 30;
      const barPadding = 5;
      
      // === NEON HUD DESIGN ===
      const minimapWidth = 120;
      const minimapX = CANVAS_WIDTH - minimapWidth - 10;
      
      // HUD Container with neon border
      const hudX = 8;
      const hudY = 8;
      const hudWidth = 520; // Expandido para incluir XP
      const hudHeight = 36;
      const hudRadius = 8;
      
      // Draw rounded rectangle background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudWidth, hudHeight, hudRadius);
      ctx.fill();
      
      // Neon border glow
      ctx.strokeStyle = '#33ffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#33ffff';
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudWidth, hudHeight, hudRadius);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // === LEVEL BADGE ===
      const levelX = hudX + 12;
      const levelY = hudY + 10;
      ctx.fillStyle = '#33ffff';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#33ffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`LV ${game.level}`, levelX, levelY + 14);
      ctx.shadowBlur = 0;
      
      // === STARS BAR ===
      const starsBarX = levelX + 65;
      const starsBarY = hudY + 10;
      const starsBarWidth = 130;
      const starsBarHeight = 16;
      
      // Stars bar background with rounded corners
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.beginPath();
      ctx.roundRect(starsBarX, starsBarY, starsBarWidth, starsBarHeight, 4);
      ctx.fill();
      
      // Stars bar border
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(starsBarX, starsBarY, starsBarWidth, starsBarHeight, 4);
      ctx.stroke();
      
      // Stars bar fill with glow
      const starsPercent = Math.min(game.currentStars / game.starsNeeded, 1);
      if (starsPercent > 0) {
      ctx.fillStyle = '#FFD700';
        ctx.shadowBlur = 6;
      ctx.shadowColor = '#FFD700';
        ctx.beginPath();
        ctx.roundRect(starsBarX + 2, starsBarY + 2, (starsBarWidth - 4) * starsPercent, starsBarHeight - 4, 3);
        ctx.fill();
      ctx.shadowBlur = 0;
      }
      
      // Stars icon and text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      const starsText = `⭐ ${game.currentStars}/${game.starsNeeded}`;
      const starsTextWidth = ctx.measureText(starsText).width;
      ctx.fillText(starsText, starsBarX + starsBarWidth / 2 - starsTextWidth / 2, starsBarY + 12);
      
      // === HEALTH BAR ===
      const healthBarX = starsBarX + starsBarWidth + 15;
      const healthBarY = hudY + 10;
      const healthBarWidth = 130;
      const healthBarHeight2 = 16;
      
      // Health bar background with rounded corners
      ctx.fillStyle = 'rgba(255, 80, 80, 0.2)';
      ctx.beginPath();
      ctx.roundRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight2, 4);
      ctx.fill();
      
      // Health bar border
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight2, 4);
      ctx.stroke();
      
      // Health bar fill with glow
      const healthPercent = Math.max(0, game.currentHealth / game.maxHealth);
      if (healthPercent > 0) {
        // Color changes based on health level
        const healthColor = healthPercent > 0.5 ? '#00ff88' : healthPercent > 0.25 ? '#ffaa00' : '#ff3333';
        ctx.fillStyle = healthColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = healthColor;
        ctx.beginPath();
        ctx.roundRect(healthBarX + 2, healthBarY + 2, (healthBarWidth - 4) * healthPercent, healthBarHeight2 - 4, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      // Health icon and text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      const healthText = `❤️ ${game.currentHealth}/${game.maxHealth}`;
      const healthTextWidth = ctx.measureText(healthText).width;
      ctx.fillText(healthText, healthBarX + healthBarWidth / 2 - healthTextWidth / 2, healthBarY + 12);
      
      // === SESSION XP COUNTER (with dynamic color) ===
      const xpCounterX = healthBarX + healthBarWidth + 15;
      const xpCounterY = hudY + 10;
      const xpCounterWidth = 80;
      const xpCounterHeight = 16;
      
      // Calcular color dinámico basado en el XP de sesión
      // 0-25: Rojo -> Naranja, 25-50: Naranja -> Amarillo, 50-75: Amarillo -> Verde, 75-100+: Verde -> Azul
      const sessionXP = game.sessionXP || 0;
      let xpColor;
      if (sessionXP < 25) {
        // Rojo a Naranja (0-25)
        const t = sessionXP / 25;
        const r = 255;
        const g = Math.floor(100 * t);
        const b = 0;
        xpColor = `rgb(${r}, ${g}, ${b})`;
      } else if (sessionXP < 50) {
        // Naranja a Amarillo (25-50)
        const t = (sessionXP - 25) / 25;
        const r = 255;
        const g = Math.floor(100 + 155 * t);
        const b = 0;
        xpColor = `rgb(${r}, ${g}, ${b})`;
      } else if (sessionXP < 75) {
        // Amarillo a Verde (50-75)
        const t = (sessionXP - 50) / 25;
        const r = Math.floor(255 * (1 - t));
        const g = 255;
        const b = 0;
        xpColor = `rgb(${r}, ${g}, ${b})`;
      } else if (sessionXP < 100) {
        // Verde a Azul (75-100)
        const t = (sessionXP - 75) / 25;
        const r = 0;
        const g = Math.floor(255 * (1 - t));
        const b = Math.floor(255 * t);
        xpColor = `rgb(${r}, ${g}, ${b})`;
      } else {
        // Azul (100+)
        xpColor = '#00aaff';
      }
      
      // XP counter background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.roundRect(xpCounterX, xpCounterY, xpCounterWidth, xpCounterHeight, 4);
      ctx.fill();
      
      // XP counter border with dynamic color
      ctx.strokeStyle = xpColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = xpColor;
      ctx.beginPath();
      ctx.roundRect(xpCounterX, xpCounterY, xpCounterWidth, xpCounterHeight, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // XP text with dynamic color
      ctx.fillStyle = xpColor;
      ctx.shadowBlur = 4;
      ctx.shadowColor = xpColor;
      ctx.font = 'bold 11px monospace';
      const xpText = `⚡ ${sessionXP}`;
      const xpTextWidth = ctx.measureText(xpText).width;
      ctx.fillText(xpText, xpCounterX + xpCounterWidth / 2 - xpTextWidth / 2, xpCounterY + 12);
      ctx.shadowBlur = 0;
      
      // === TOTAL XP/STARS (compact, next to minimap) ===
      const statsX = minimapX - 90;
      ctx.fillStyle = '#33ffff';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#33ffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`XP: ${totalXP}`, statsX, 22);
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.fillText(`⭐: ${totalStars}`, statsX, 36);
      ctx.shadowBlur = 0;
      
      // Draw minimap in top-right corner (after HUD so it's visible)
      // minimapWidth and minimapX already declared above for HUD spacing
      const minimapHeight = 90;
      const minimapY = 10; // Fixed at top-right corner, close to edge
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
      
      ctx.strokeStyle = '#33ffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);
      
      // Draw player position on minimap (distinctive marker)
      const playerMinimapX = minimapX + (game.snake[0].x / game.worldWidth) * minimapWidth;
      const playerMinimapY = minimapY + (game.snake[0].y / game.worldHeight) * minimapHeight;
      
      // Outer ring for player
      ctx.strokeStyle = '#33ffff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#33ffff';
      ctx.beginPath();
      ctx.arc(playerMinimapX, playerMinimapY, 4, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner filled circle for player
      ctx.fillStyle = '#33ffff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(playerMinimapX, playerMinimapY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw enemy positions on minimap as colored dots
      game.enemies.forEach(enemy => {
        if (enemy.segments && enemy.segments.length > 0) {
          const enemyHead = enemy.segments[0];
          const enemyMinimapX = minimapX + (enemyHead.x / game.worldWidth) * minimapWidth;
          const enemyMinimapY = minimapY + (enemyHead.y / game.worldHeight) * minimapHeight;
          
          // Use the enemy's hue color
          ctx.fillStyle = `hsl(${enemy.hue}, 100%, 50%)`;
          ctx.shadowBlur = 5;
          ctx.shadowColor = `hsl(${enemy.hue}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(enemyMinimapX, enemyMinimapY, 2, 0, Math.PI * 2);
          ctx.fill();
      ctx.shadowBlur = 0;
        }
      });
      
      // Shop hint (only on desktop, not mobile)
      if (!isMobile) {
      ctx.fillStyle = '#ff00ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('[J] Tienda', 10, CANVAS_HEIGHT - 15);
      
      // Cannon hint (if cannon is equipped)
      if (cannonLevel > 0) {
        // Calcular cuántas balas consume
        let bulletCost = 1;
        if (cannonLevel >= 2) bulletCost = 2;
        if (cannonLevel >= 3) bulletCost = 3;
        if (cannonLevel >= 4) bulletCost = 4;
        
        if (freeShots) {
          ctx.fillStyle = '#00ff88';
          ctx.fillText('[ESPACIO] Disparar (GRATIS)', 120, CANVAS_HEIGHT - 15);
        } else {
          const canShootNow = game.sessionXP >= bulletCost;
          ctx.fillStyle = canShootNow ? '#ffff00' : '#ff4444';
          ctx.fillText(`[ESPACIO] Disparar (-${bulletCost} XP)`, 120, CANVAS_HEIGHT - 15);
        }
        }
      }
    };

    const gameLoop = (currentTime) => {
      // IMPORTANTE: No continuar si el juego no está en estado 'playing'
      if (gameState !== 'playing') {
        return; // Detener el loop
      }
      
      // Usamos un timestep fijo para velocidad consistente
      update(FRAME_TIME);
      draw();
      animationId = requestAnimationFrame(gameLoop);
    };

    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchend', handleJoystickEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleJoystickEnd, { passive: false });
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      lastTime = performance.now(); // Initialize time tracking
      gameLoop(performance.now());
    }

    // Un solo cleanup que maneja todo
    return () => {
      // CRÍTICO: Cancelar el animationFrame para evitar múltiples loops
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Limpiar event listeners
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchend', handleJoystickEnd);
        canvas.removeEventListener('touchcancel', handleJoystickEnd);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Limpiar auto-fire
      isShootingRef.current = false;
      if (shootingIntervalRef.current) {
        clearTimeout(shootingIntervalRef.current);
        shootingIntervalRef.current = null;
      }
    };
  }, [gameState, shieldLevel, headLevel, cannonLevel, bulletSpeedLevel, shopOpen, showAdminPanel, isAdmin, freeShots]); // Quitado totalXP de las dependencias

  const startGame = () => {
    gameRef.current.level = level;
    const levelConfig = getLevelConfig(level, levelConfigs);
    gameRef.current.starsNeeded = levelConfig.starsNeeded;
    gameRef.current.gameStartTime = Date.now();
    gameRef.current.sessionXP = 0;
    gameRef.current.headHits = 0; // Reset head hits counter
    gameRef.current.bodyHits = 0; // Reset body hits counter
    setScore(0);
    initGame();
    setShopOpen(false);
    setGameState('playing');
  };

  const initGame = () => {
    const game = gameRef.current;
    const levelConfig = getLevelConfig(game.level, levelConfigs);
    
    // Central rectangle (1 screen size = 800x600) - solo si el nivel lo requiere
    if (levelConfig.hasCentralCell) {
      const centralRect = {
        x: game.worldWidth / 2 - CANVAS_WIDTH / 2,
        y: game.worldHeight / 2 - CANVAS_HEIGHT / 2,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        openings: [
          { 
            side: 'top', 
            position: 0, // Position along the side (0 to 1)
            direction: 1, // Always moving forward (will wrap)
            speed: levelConfig.centralCellOpeningSpeed, // Velocidad basada en nivel
            width: 60, 
            height: 20,
            paused: false // Pause when player is passing through
          },
          { 
            side: 'bottom', 
            position: 0.5,
            direction: 1,
            speed: levelConfig.centralCellOpeningSpeed,
            width: 60, 
            height: 20,
            paused: false
          },
          { 
            side: 'left', 
            position: 0.3,
            direction: 1,
            speed: levelConfig.centralCellOpeningSpeed,
            width: 20, 
            height: 60,
            paused: false
          },
          { 
            side: 'right', 
            position: 0.7,
            direction: 1,
            speed: levelConfig.centralCellOpeningSpeed,
            width: 20, 
            height: 60,
            paused: false
          }
        ]
      };
      game.centralRect = centralRect;
    } else {
      game.centralRect = null; // Sin celda del medio en niveles bajos
    }
    
    // Create regular food across the map - usar xpPoints del nivel
    game.food = Array.from({ length: levelConfig.xpPoints }, () => createFood());
    
    // Add yellow/orange orbs inside central rectangle (solo si existe)
    if (game.centralRect) {
      const centralFoodCount = Math.floor(levelConfig.xpPoints * 0.3); // 30% de la comida en el centro
      for (let i = 0; i < centralFoodCount; i++) {
        const color = Math.random() < 0.5 ? 'yellow' : 'orange';
        const food = createFood(color);
        food.x = game.centralRect.x + 50 + Math.random() * (game.centralRect.width - 100);
        food.y = game.centralRect.y + 50 + Math.random() * (game.centralRect.height - 100);
        game.food.push(food);
      }
    }
    
    // Guardar la cantidad inicial de comida para mantenerla constante
    game.initialFoodCount = game.food.length;
    
    // Crear enemigos PRIMERO para luego buscar spawn seguro para el jugador
    game.enemies = Array.from({ length: levelConfig.enemyCount }, () => {
      return createEnemy(levelConfig, game.level);
    });
    
    // Create new entities based on level config
    game.killerSaws = Array.from({ length: levelConfig.killerSawCount }, () => createKillerSaw(levelConfig));
    game.floatingCannons = Array.from({ length: levelConfig.floatingCannonCount }, () => createFloatingCannon(levelConfig));
    game.resentfulSnakes = Array.from({ length: levelConfig.resentfulSnakeCount }, () => createResentfulSnake(levelConfig));
    game.healthBoxes = Array.from({ length: levelConfig.healthBoxCount }, () => createHealthBox(levelConfig));
    
    console.log(`🎮 Iniciando juego nivel ${level} con ${game.enemies.length} enemigos, ${game.killerSaws.length} sierras, ${game.floatingCannons.length} canones, ${game.resentfulSnakes.length} viboras resentidas`);
    
    // Spawn player: lejos del borde, lejos de enemigos, fuera del centralRect
    const EDGE_MARGIN = 300; // Distancia mínima del borde
    const ENEMY_SAFE_DISTANCE = 200; // Distancia mínima de cualquier enemigo
    
    let spawnX, spawnY;
    let attempts = 0;
    let validSpawn = false;
    
    do {
      // Random position con margen del borde
      spawnX = EDGE_MARGIN + Math.random() * (game.worldWidth - EDGE_MARGIN * 2);
      spawnY = EDGE_MARGIN + Math.random() * (game.worldHeight - EDGE_MARGIN * 2);
      
      validSpawn = true;
      
      // Check if it's outside the central rectangle (with margin for safety) - solo si existe
      if (game.centralRect) {
        const margin = 50;
        const isOutside = spawnX < game.centralRect.x - margin || 
                         spawnX > game.centralRect.x + game.centralRect.width + margin ||
                         spawnY < game.centralRect.y - margin || 
                         spawnY > game.centralRect.y + game.centralRect.height + margin;
        
        if (!isOutside) {
          validSpawn = false;
        }
      }
      
      // Verificar distancia de todos los enemigos
      if (validSpawn) {
        for (const enemy of game.enemies) {
          if (enemy.segments && enemy.segments.length > 0) {
            const head = enemy.segments[0];
            const dx = spawnX - head.x;
            const dy = spawnY - head.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < ENEMY_SAFE_DISTANCE) {
              validSpawn = false;
        break;
      }
          }
        }
      }
      
      attempts++;
    } while (!validSpawn && attempts < 100); // Safety limit
    
    // Fallback: si no encontró posición segura, buscar la más alejada de enemigos
    if (!validSpawn) {
      let bestX = game.worldWidth / 2;
      let bestY = game.worldHeight / 2;
      let bestMinDistance = 0;
      
      // Probar varias posiciones y elegir la mejor
      for (let i = 0; i < 20; i++) {
        const testX = EDGE_MARGIN + Math.random() * (game.worldWidth - EDGE_MARGIN * 2);
        const testY = EDGE_MARGIN + Math.random() * (game.worldHeight - EDGE_MARGIN * 2);
        
        let minDistance = Infinity;
        for (const enemy of game.enemies) {
          if (enemy.segments && enemy.segments.length > 0) {
            const head = enemy.segments[0];
            const dx = testX - head.x;
            const dy = testY - head.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
          }
        }
        
        if (minDistance > bestMinDistance) {
          bestMinDistance = minDistance;
          bestX = testX;
          bestY = testY;
        }
      }
      
      spawnX = bestX;
      spawnY = bestY;
    }
    
    game.snake = [{ x: spawnX, y: spawnY }];
    game.direction = { x: 1, y: 0 };
    game.nextDirection = { x: 1, y: 0 };
    // Aplicar velocidad del nivel
    game.speed = levelConfig.playerSpeed;
    game.baseSpeed = levelConfig.playerSpeed;
    game.snakeSize = SNAKE_SIZE;
    game.bullets = [];
    game.particles = [];
    game.stars = []; // Reset stars
    game.currentXP = 0;
    game.currentStars = 0;
    game.starsNeeded = levelConfig.starsNeeded;
    // Inicializar vida del jugador basada en healthLevel: 0=2, 1=4, 2=6... 10=22
    game.maxHealth = 2 + (healthLevel * 2);
    game.currentHealth = game.maxHealth;
    // Reset efectos visuales
    game.damageFlash = 0;
    game.healFlash = 0;
    game.invulnerable = 0;
    game.camera = { 
      x: game.worldWidth / 2 - CANVAS_WIDTH / 2, 
      y: game.worldHeight / 2 - CANVAS_HEIGHT / 2 
    };
    setCurrentLevelXP(0);
    setCurrentLevelStars(0);
  };

  const nextLevel = () => {
    const newLevel = level + 1;
    setLevel(newLevel);
    gameRef.current.level = newLevel;
    const levelConfig = getLevelConfig(newLevel, levelConfigs);
    gameRef.current.starsNeeded = levelConfig.starsNeeded;
    gameRef.current.gameStartTime = Date.now();
    gameRef.current.sessionXP = 0;
    gameRef.current.currentStars = 0; // Reset stars for new level
    gameRef.current.headHits = 0; // Reset head hits counter
    gameRef.current.bodyHits = 0; // Reset body hits counter
    setScore(0);
    setCurrentLevelStars(0);
    initGame();
    setShopOpen(false);
    setGameState('playing');
  };

  const handleRebirth = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}/rebirth`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({}) // Body vacío requerido por Fastify con Content-Type JSON
      });
      
      if (!response.ok) {
        throw new Error('Error al hacer rebirth');
      }
      
      const data = await response.json();
      
      // Actualizar estados locales
      setRebirthCount(data.rebirthCount);
      setCurrentSeries(data.currentSeries);
      setLevel(1);
      setTotalXP(0);
      setTotalStars(0);
      setCurrentLevelXP(0);
      setCurrentLevelStars(0);
      
      // Actualizar niveles de tienda según rebirth
      const baseLevel = data.rebirthCount;
      setShieldLevel(baseLevel);
      setCannonLevel(baseLevel);
      setMagnetLevel(baseLevel);
      setSpeedLevel(baseLevel);
      setBulletSpeedLevel(baseLevel);
      setHealthLevel(baseLevel);
      setHeadLevel(1 + baseLevel);
      
      // Volver al menú
      setGameState('menu');
      setVictoryData(null);
      
      console.log(`🔄 Rebirth completado! Serie ${data.currentSeries}, Base Level: ${baseLevel}`);
    } catch (error) {
      console.error('Error en rebirth:', error);
      alert('Error al hacer rebirth. Intenta de nuevo.');
    }
  };

  const buyItem = (item) => {
    if (!shopConfigs) return;
    
    // Parse item type and level from item string (e.g., "shield1" -> type: "shield", level: 1)
    const match = item.match(/^(\w+)(\d+)$/);
    if (!match) return;
    
    const [, type, levelStr] = match;
    const level = parseInt(levelStr);
    
    // Find the upgrade configuration
    const upgrades = shopConfigs[type];
    if (!upgrades) return;
    
    const upgrade = upgrades.find(u => Number(u.level) === level);
    if (!upgrade) return;
    
    const cost = { xp: upgrade.xpCost, stars: upgrade.starsCost };
    
    // Check if user has enough resources
    if (totalXP >= cost.xp && totalStars >= cost.stars) {
      setTotalXP(prev => prev - cost.xp);
      setTotalStars(prev => prev - cost.stars);
      
      // Update the appropriate level state
      if (type === 'shield') {
        setShieldLevel(level);
      } else if (type === 'magnet') {
        setMagnetLevel(level);
      } else if (type === 'cannon') {
        setCannonLevel(level);
      } else if (type === 'speed') {
        setSpeedLevel(level);
      } else if (type === 'bullet_speed') {
        setBulletSpeedLevel(level);
      } else if (type === 'head') {
        setHeadLevel(level);
      } else if (type === 'health') {
        setHealthLevel(level);
      }
      
      setShopOpen(false);
      
      // Save progress after purchase
      setTimeout(() => saveUserProgress(), 100);
    }
  };
  
  // Helper to get next upgrade level and cost for each type
  const getNextUpgrade = (type) => {
    if (!shopConfigs || !shopConfigs[type]) {
      return null;
    }

    const upgrades = shopConfigs[type];
    let currentLevel = 0;

    if (type === 'shield') {
      currentLevel = shieldLevel;
    } else if (type === 'magnet') {
      currentLevel = magnetLevel;
    } else if (type === 'cannon') {
      currentLevel = cannonLevel;
    } else if (type === 'speed') {
      currentLevel = speedLevel;
    } else if (type === 'bullet_speed') {
      currentLevel = bulletSpeedLevel;
    } else if (type === 'head') {
      currentLevel = headLevel;
    } else if (type === 'health') {
      currentLevel = healthLevel;
    }

    // Find the next upgrade level
    // Ensure we're comparing numbers, not strings
    const nextLevel = currentLevel + 1;
    const nextUpgrade = upgrades.find(upgrade => Number(upgrade.level) === nextLevel);
    
    if (!nextUpgrade) {
      return null; // Max level reached
    }

    return {
      level: nextUpgrade.level,
      item: `${type}${nextUpgrade.level}`,
      cost: { xp: nextUpgrade.xpCost, stars: nextUpgrade.starsCost },
      desc: nextUpgrade.description
    };
  };

  if (loading) {
  return (
    <div style={{ 
      display: 'flex', 
        justifyContent: 'center',
      alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#33ffff',
        fontSize: '24px',
        fontFamily: 'monospace'
      }}>
        Cargando progreso...
      </div>
    );
  }

  // Header component with user info
  const UserHeader = () => {
    const game = gameRef.current;
    const levelProgress = gameState === 'playing' ? (game.currentXP / game.xpNeeded) * 100 : 0;
    
    // Compact styles for playing state
    if (gameState === 'playing') {
      const compactPadding = isMobile ? '4px 8px' : '6px 12px';
      const compactFontSize = isMobile ? '11px' : '13px';
      return (
        <div style={{
          width: '100%',
          background: 'rgba(0, 0, 0, 0.95)',
          borderBottom: '1px solid #33ffff',
          padding: compactPadding,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 10px rgba(51, 255, 255, 0.2)',
          zIndex: 1000
        }}>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '12px' : '20px', 
            alignItems: 'center'
          }}>
            <span style={{ fontSize: compactFontSize, color: '#33ffff', fontWeight: 'bold' }}>
              Nivel {game.level}
            </span>
            <span style={{ fontSize: compactFontSize, color: '#33ffff' }}>
              XP: {currentLevelXP}
            </span>
            <span style={{ fontSize: compactFontSize, color: '#FFD700' }}>
              ⭐ {currentLevelStars} / {game.starsNeeded}
            </span>
          </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              style={{
                background: 'transparent',
                border: '1px solid #33ffff',
                color: '#33ffff',
                padding: isMobile ? '4px 8px' : '5px 10px',
                fontSize: isMobile ? '9px' : '11px',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(51, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              Admin
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid #ff3366',
              color: '#ff3366',
                  padding: isMobile ? '4px 8px' : '5px 10px',
                  fontSize: isMobile ? '9px' : '11px',
              cursor: 'pointer',
                  borderRadius: '3px',
                  transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 51, 102, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            Salir
          </button>
        </div>
        </div>
      );
    }
    
    // Mobile styles
    const headerPadding = isMobile ? '8px 10px' : '15px 20px';
    const labelFontSize = isMobile ? '8px' : '11px';
    const valueFontSize = isMobile ? '12px' : '16px';
    const gap = isMobile ? '8px' : '30px';
    const iconSize = isMobile ? 14 : 18;
    const iconTextSize = isMobile ? '10px' : '12px';
    
    if (isMobile) {
      // Mobile layout: column
      return (
        <div style={{
          width: '100%',
          background: 'rgba(0, 0, 0, 0.95)',
          borderBottom: '2px solid #33ffff',
          padding: headerPadding,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 20px rgba(51, 255, 255, 0.3)',
          zIndex: 1000,
          gap: '8px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: gap, 
            alignItems: 'center', 
            flexWrap: 'wrap',
            width: '100%'
          }}>
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Usuario</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {user?.username || 'Usuario'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>XP Total</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {totalXP}
              </div>
            </div>
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>⭐ Total</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#FFD700' }}>
                {totalStars}
              </div>
            </div>
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Nivel Global</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {level}
              </div>
            </div>
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Serie</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff00ff' }}>
                {currentSeries}
              </div>
            </div>
            {rebirthCount > 0 && (
              <div>
                <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Rebirth</div>
                <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff3366' }}>
                  ♻️ {rebirthCount}
                </div>
              </div>
            )}
          </div>
          {gameState === 'playing' && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '4px' }}>
                Progreso: ⭐ {game.currentStars} / {game.starsNeeded}
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 215, 0, 0.2)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(game.currentStars / game.starsNeeded) * 100}%`,
                  height: '100%',
                  background: '#FFD700',
                  boxShadow: '0 0 10px #FFD700',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '4px', marginTop: '8px' }}>
                Vida: ❤️ {game.currentHealth} / {game.maxHealth}
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 80, 80, 0.2)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.max(0, (game.currentHealth / game.maxHealth) * 100)}%`,
                  height: '100%',
                  background: game.currentHealth / game.maxHealth > 0.3 ? '#ff5050' : '#ff2222',
                  boxShadow: '0 0 10px #ff5050',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center', 
            width: '100%'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              alignItems: 'center', 
              flexWrap: 'wrap'
          }}>
            {shieldLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Shield size={iconSize} style={{ color: '#6495ed' }} />
                <span style={{ fontSize: iconTextSize, color: '#6495ed' }}>Escudo {shieldLevel}</span>
              </div>
            )}
            {headLevel > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Zap size={iconSize} style={{ color: headLevel === 2 ? '#ff00ff' : '#9400D3' }} />
                <span style={{ fontSize: iconTextSize, color: headLevel === 2 ? '#ff00ff' : '#9400D3' }}>
                  {headLevel === 2 ? 'Doble' : 'Triple'}
                </span>
              </div>
            )}
            {cannonLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Sparkles size={iconSize} style={{ color: '#ffff00' }} />
                <span style={{ fontSize: iconTextSize, color: '#ffff00' }}>
                  Cañón {cannonLevel === 2 ? 'x2' : ''}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #33ffff',
                  color: '#33ffff',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(51, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                Admin
              </button>
            )}
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid #ff3366',
              color: '#ff3366',
                  padding: '4px 8px',
                  fontSize: '10px',
              cursor: 'pointer',
                  borderRadius: '3px',
                  transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 51, 102, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
                Salir
          </button>
          </div>
          </div>
        </div>
      );
    }
    
    // Desktop layout: original horizontal design
    return (
      <div style={{
        width: '100%',
        background: 'rgba(0, 0, 0, 0.95)',
        borderBottom: '2px solid #33ffff',
        padding: headerPadding,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 20px rgba(51, 255, 255, 0.3)',
        zIndex: 1000
      }}>
        <div style={{ 
          display: 'flex', 
          gap: gap, 
          alignItems: 'center', 
          flex: 1
        }}>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Usuario</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {user?.username || 'Usuario'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>XP Total</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {totalXP}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>⭐ Total</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#FFD700' }}>
              {totalStars}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Nivel Global</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {level}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Serie</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff00ff' }}>
              {currentSeries}
            </div>
          </div>
          {rebirthCount > 0 && (
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>Rebirth</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff3366' }}>
                ♻️ {rebirthCount}
              </div>
            </div>
          )}
          {gameState === 'playing' && (
            <div style={{ flex: 1, maxWidth: '300px', marginLeft: '20px' }}>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '4px' }}>
                Progreso Nivel: ⭐ {game.currentStars} / {game.starsNeeded}
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 215, 0, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(game.currentStars / game.starsNeeded) * 100}%`,
                  height: '100%',
                  background: '#FFD700',
                  boxShadow: '0 0 10px #FFD700',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '4px', marginTop: '8px' }}>
                Vida: ❤️ {game.currentHealth} / {game.maxHealth}
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'rgba(255, 80, 80, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.max(0, (game.currentHealth / game.maxHealth) * 100)}%`,
                  height: '100%',
                  background: game.currentHealth / game.maxHealth > 0.3 ? '#ff5050' : '#ff2222',
                  boxShadow: '0 0 10px #ff5050',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
        </div>
          <div style={{ 
            display: 'flex', 
          gap: '12px', 
          alignItems: 'center'
          }}>
            {shieldLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={iconSize} style={{ color: '#6495ed' }} />
                <span style={{ fontSize: iconTextSize, color: '#6495ed' }}>Escudo {shieldLevel}</span>
              </div>
            )}
            {headLevel > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={iconSize} style={{ color: headLevel === 2 ? '#ff00ff' : '#9400D3' }} />
                <span style={{ fontSize: iconTextSize, color: headLevel === 2 ? '#ff00ff' : '#9400D3' }}>
                  {headLevel === 2 ? 'Doble' : 'Triple'}
                </span>
              </div>
            )}
            {cannonLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={iconSize} style={{ color: '#ffff00' }} />
                <span style={{ fontSize: iconTextSize, color: '#ffff00' }}>
                  Cañón {cannonLevel === 2 ? 'x2' : ''}
                </span>
              </div>
            )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              style={{
                background: 'transparent',
                border: '1px solid #33ffff',
                color: '#33ffff',
                padding: '5px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                borderRadius: '3px',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(51, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              Admin
            </button>
          )}
        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            border: '1px solid #ff3366',
            color: '#ff3366',
                  padding: '5px 10px',
                  fontSize: '11px',
            cursor: 'pointer',
                  borderRadius: '3px',
            transition: 'all 0.3s',
                  marginLeft: '10px'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 51, 102, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
          }}
        >
                Salir
        </button>
        </div>
          </div>
      </div>
    );
  };

  // Show banned message if user is banned
  if (isBanned) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#ff3366',
        fontSize: '24px',
        fontFamily: 'monospace',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h1 style={{ color: '#ff3366', margin: 0 }}>Cuenta Suspendida</h1>
        <p style={{ color: '#888', fontSize: '16px' }}>
          Tu cuenta ha sido suspendida. Por favor contacta al administrador.
        </p>
        <button
          onClick={onLogout}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: '2px solid #ff3366',
            color: '#ff3366',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
      color: '#33ffff',
      fontFamily: 'monospace',
      overflow: 'hidden'
    }}>
      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel onClose={() => {
          setShowAdminPanel(false);
          // Reload level configs after admin changes
          if (isAdmin) {
            loadLevelConfigs();
          }
        }} />
      )}
      
      {/* Header siempre visible */}
      <UserHeader />
      
      {/* Content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: gameState === 'playing' ? '0' : '20px',
        overflow: gameState === 'playing' ? 'hidden' : 'auto',
        position: 'relative',
        width: '100%',
        height: '100%'
      }}>

      {gameState === 'menu' && (
        <div style={{ 
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '20px',
          width: '100%',
          maxWidth: '1200px',
          padding: '20px',
          alignItems: isMobile ? 'center' : 'flex-start',
          justifyContent: 'center'
        }}>
          {/* Left side: Main action buttons */}
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
            padding: '30px',
          borderRadius: '10px',
          border: '2px solid #33ffff',
            boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? 'auto' : '400px',
            flex: isMobile ? 'none' : '0 0 400px'
          }}>
            <img 
              src="/logo.png" 
              alt="Neon Snake" 
              style={{ 
                width: '100%', 
                maxWidth: '400px', 
                height: 'auto',
                marginBottom: '20px',
                filter: 'drop-shadow(0 0 20px rgba(0, 255, 0, 0.5))'
              }} 
            />
            <p style={{ fontSize: '16px', marginBottom: '30px', lineHeight: '1.6', color: '#aaa' }}>
            Mueve el mouse/trackpad para controlar tu serpiente<br/>
            Come puntos brillantes para ganar XP<br/>
            ⭐ Recoge estrellas para avanzar de nivel
          </p>
            <div style={{ display: 'flex', gap: '15px', flexDirection: isMobile ? 'column' : 'row' }}>
          <button 
            onClick={startGame}
            style={{
              background: 'transparent',
              border: '2px solid #33ffff',
              color: '#33ffff',
              padding: '15px 40px',
                  fontSize: '20px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #33ffff',
              boxShadow: '0 0 20px rgba(51, 255, 255, 0.5)',
                  flex: 1,
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(51, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
            }}
          >
            JUGAR
          </button>
          <button 
            onClick={() => setGameState('shop')}
            style={{
              background: 'transparent',
              border: '2px solid #ff00ff',
              color: '#ff00ff',
              padding: '15px 40px',
                  fontSize: '20px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #ff00ff',
                  boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
                  flex: 1,
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 0, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
            }}
          >
            TIENDA
          </button>
            </div>
          </div>

          {/* Right side: Leaderboard */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '25px',
            borderRadius: '10px',
            border: '2px solid #FFD700',
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? 'auto' : '400px',
            flex: isMobile ? 'none' : '1'
          }}>
            <h2 style={{ 
              color: '#FFD700', 
              textShadow: '0 0 20px #FFD700', 
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '22px'
            }}>
              🏆 RANKING
            </h2>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {leaderboard.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Cargando ranking...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #FFD700' }}>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>#</th>
                      <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>Usuario</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>Puntos</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr 
                        key={index}
                        style={{ 
                          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                          backgroundColor: entry.username === user?.username ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '8px', color: index < 3 ? '#FFD700' : '#33ffff', fontSize: '14px' }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                        </td>
                        <td style={{ padding: '8px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '14px' }}>
                          {entry.username}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '14px' }}>
                          {entry.bestScore?.toLocaleString() || 0}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '14px' }}>
                          {entry.highestLevel || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {gameState === 'shop' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.95)',
          padding: '30px',
          borderRadius: '10px',
          border: '3px solid #ff00ff',
          boxShadow: '0 0 40px rgba(255, 0, 255, 0.5)',
          maxWidth: '1400px',
          width: '100%',
          margin: '20px auto',
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          position: 'relative'
        }}>
          <button
            onClick={() => setGameState('menu')}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: '2px solid #33ffff',
              color: '#33ffff',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer',
              borderRadius: '5px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(51, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            VOLVER
          </button>
          <h2 style={{ color: '#ff00ff', textShadow: '0 0 20px #ff00ff', textAlign: 'center', fontSize: '24px', marginBottom: '15px' }}>
            TIENDA
          </h2>
          <p style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center' }}>
            XP Total: {totalXP} | ⭐ Total: {totalStars}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px', alignItems: 'stretch' }}>
            {/* Escudo */}
            {(() => {
              const next = getNextUpgrade('shield');
              const currentLevel = shieldLevel;
              return (
                <div style={{ 
                  border: '2px solid #6495ed', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(100, 149, 237, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Shield size={36} style={{ color: '#6495ed', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#6495ed', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    ESCUDO {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {next ? (
                    <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                        {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                        {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                        style={{
                          background: 'transparent',
                          border: '2px solid #6495ed',
                          color: '#6495ed',
                            padding: '8px 16px',
                            fontSize: '14px',
                          cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                          width: '100%',
                            marginTop: 'auto'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Imán XP */}
            {(() => {
              const next = getNextUpgrade('magnet');
              const currentLevel = magnetLevel;
              return (
                <div style={{ 
                  border: '2px solid #00ff88', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Magnet size={36} style={{ color: '#00ff88', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#00ff88', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    IMÁN XP {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {next ? (
                    <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                        {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                        {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                        style={{
                          background: 'transparent',
                          border: '2px solid #00ff88',
                          color: '#00ff88',
                            padding: '8px 16px',
                            fontSize: '14px',
                          cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                          width: '100%',
                            marginTop: 'auto'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Cañón */}
            {(() => {
              const next = getNextUpgrade('cannon');
              const currentLevel = cannonLevel;
              return (
                <div style={{ 
                  border: '2px solid #ffff00', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(255, 255, 0, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Sparkles size={36} style={{ color: '#ffff00', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#ffff00', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    CAÑÓN {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {next ? (
                    <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                        {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                        {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                        style={{
                          background: 'transparent',
                          border: '2px solid #ffff00',
                          color: '#ffff00',
                            padding: '8px 16px',
                            fontSize: '14px',
                          cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                          width: '100%',
                            marginTop: 'auto'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Velocidad */}
            {(() => {
              const next = getNextUpgrade('speed');
              const currentLevel = speedLevel;
              return (
                <div style={{ 
                  border: '2px solid #ff3366', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(255, 51, 102, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Gauge size={36} style={{ color: '#ff3366', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#ff3366', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    VELOCIDAD {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {next ? (
                    <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                        {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                        {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                        style={{
                          background: 'transparent',
                          border: '2px solid #ff3366',
                          color: '#ff3366',
                            padding: '8px 16px',
                            fontSize: '14px',
                          cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                          width: '100%',
                            marginTop: 'auto'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
                  </div>
                </div>
              );
            })()}

            {/* Velocidad de Bala */}
            {(() => {
              const next = getNextUpgrade('bullet_speed');
              const currentLevel = bulletSpeedLevel;
              return (
                <div style={{ 
                  border: '2px solid #00ff00', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Sparkles size={36} style={{ color: '#00ff00', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#00ff00', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    VELOCIDAD BALA {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {next ? (
                      <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                          {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                          {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                        </p>
          <button 
                          onClick={() => buyItem(next.item)}
                          disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
            style={{
              background: 'transparent',
                            border: '2px solid #00ff00',
                            color: '#00ff00',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                            borderRadius: '5px',
                            opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                            width: '100%',
                            marginTop: 'auto'
                          }}
                        >
                          COMPRAR NIVEL {next.level}
          </button>
                      </>
                    ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                        Nivel Máximo
                      </p>
                    )}
          </div>
                </div>
              );
            })()}

            {/* Puntos de Vida */}
            {(() => {
              const next = getNextUpgrade('health');
              const currentLevel = healthLevel;
              return (
                <div style={{ 
                  border: '2px solid #ff5050', 
                  padding: '15px', 
                  borderRadius: '10px',
                  background: currentLevel > 0 ? 'rgba(255, 80, 80, 0.2)' : 'transparent',
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <Heart size={36} style={{ color: '#ff5050', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: '#ff5050', textAlign: 'center', fontSize: '16px', marginTop: '8px' }}>
                    VIDA {currentLevel > 0 ? `Nivel ${currentLevel}` : ''} ({2 + currentLevel * 2} ❤️)
                  </h3>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {next ? (
                      <>
                        <p style={{ textAlign: 'center', fontSize: '12px', marginTop: '8px', flex: 1 }}>{next.desc}</p>
                        <p style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>
                          {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                          {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                        </p>
          <button 
                          onClick={() => buyItem(next.item)}
                          disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
            style={{
              background: 'transparent',
                            border: '2px solid #ff5050',
                            color: '#ff5050',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                            borderRadius: '5px',
                            opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                            width: '100%',
                            marginTop: 'auto'
                          }}
                        >
                          COMPRAR NIVEL {next.level}
          </button>
                      </>
                    ) : (
                      <p style={{ textAlign: 'center', fontSize: '14px', marginTop: 'auto', color: '#888' }}>
                        Nivel Máximo
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {gameState === 'levelComplete' && (
        <div style={{ 
          display: 'flex',
          gap: '30px',
          width: '100%',
          maxWidth: '1200px',
          padding: '20px',
          alignItems: 'flex-start'
        }}>
          {/* Left side: Level complete info */}
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #00ff88',
          boxShadow: '0 0 30px rgba(0, 255, 136, 0.5)',
            zIndex: 100,
            flex: '0 0 400px'
        }}>
          <Sparkles size={64} style={{ color: '#00ff88' }} />
          <h2 style={{ color: '#00ff88', textShadow: '0 0 20px #00ff88', marginBottom: '20px' }}>
            ¡NIVEL COMPLETADO!
          </h2>
          <p style={{ fontSize: '24px', marginBottom: '30px' }}>⭐ Estrellas: {gameRef.current.currentStars}</p>
          <p style={{ fontSize: '20px', marginBottom: '30px' }}>XP Ganado: {gameRef.current.sessionXP}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <button 
            onClick={nextLevel}
            style={{
              background: 'transparent',
              border: '2px solid #00ff88',
              color: '#00ff88',
              padding: '15px 40px',
                fontSize: '20px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #00ff88',
                boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
                  transition: 'all 0.3s',
                  width: '100%'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(0, 255, 136, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
            }}
          >
            SIGUIENTE NIVEL
          </button>
            <button 
              onClick={() => {
                setGameState('playing');
                setShopOpen(true);
              }}
              style={{
                background: 'transparent',
                border: '2px solid #ff00ff',
                color: '#ff00ff',
                padding: '15px 40px',
                fontSize: '20px',
                cursor: 'pointer',
                borderRadius: '5px',
                textShadow: '0 0 10px #ff00ff',
                boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
                  transition: 'all 0.3s',
                  width: '100%'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 0, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              IR A LA TIENDA
          </button>
            </div>
          </div>

          {/* Right side: Leaderboard */}
          <div style={{ 
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '30px',
            borderRadius: '10px',
            border: '2px solid #FFD700',
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
            flex: '1',
            minWidth: '300px'
          }}>
            <h2 style={{ 
              color: '#FFD700', 
              textShadow: '0 0 20px #FFD700', 
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '24px'
            }}>
              🏆 RANKING
            </h2>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {leaderboard.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Cargando ranking...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #FFD700' }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#FFD700' }}>#</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: '#FFD700' }}>Usuario</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: '#FFD700' }}>Puntos</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: '#FFD700' }}>Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr 
                        key={index}
                        style={{ 
                          borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                          backgroundColor: entry.username === user?.username ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px', color: index < 3 ? '#FFD700' : '#33ffff' }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                        </td>
                        <td style={{ padding: '10px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal' }}>
                          {entry.username}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#33ffff' }}>
                          {entry.bestScore?.toLocaleString() || 0}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#33ffff' }}>
                          {entry.highestLevel || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {gameState === 'gameComplete' && victoryData && (
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '800px',
          padding: '40px',
          gap: '30px'
        }}>
          {/* Pantalla de Victoria */}
          <div style={{ 
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 0, 255, 0.2))',
            padding: '60px',
            borderRadius: '20px',
            border: '3px solid #FFD700',
            boxShadow: '0 0 50px rgba(255, 215, 0, 0.8), inset 0 0 30px rgba(255, 215, 0, 0.3)',
            width: '100%'
          }}>
            <div style={{ fontSize: '80px', marginBottom: '20px' }}>🎉🏆🎉</div>
            <h1 style={{ 
              color: '#FFD700', 
              textShadow: '0 0 30px #FFD700, 0 0 50px #ff00ff',
              fontSize: '48px',
              marginBottom: '20px',
              fontWeight: 'bold',
              letterSpacing: '2px'
            }}>
              ¡FELICITACIONES!
            </h1>
            <h2 style={{ 
              color: '#00ff88', 
              textShadow: '0 0 20px #00ff88',
              fontSize: '32px',
              marginBottom: '20px'
            }}>
              ¡Completaste los 25 niveles!
            </h2>
            
            {/* Serie Actual */}
            <div style={{ 
              fontSize: '20px', 
              color: '#ff00ff', 
              marginBottom: '30px',
              textShadow: '0 0 10px #ff00ff'
            }}>
              ⚡ Serie {victoryData.series} Completada ⚡
            </div>
            
            {/* Puntuación */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.6)',
              padding: '30px',
              borderRadius: '15px',
              marginBottom: '30px',
              border: '2px solid #33ffff'
            }}>
              <div style={{ fontSize: '24px', color: '#888', marginBottom: '10px' }}>
                Tu Puntuación Final
              </div>
              <div style={{ 
                fontSize: '56px', 
                color: '#33ffff', 
                fontWeight: 'bold',
                textShadow: '0 0 20px #33ffff',
                marginBottom: '20px'
              }}>
                {victoryData.score.toLocaleString()} XP
              </div>
              
              {victoryData.isNewRecord ? (
                <div style={{
                  fontSize: '28px',
                  color: '#FFD700',
                  textShadow: '0 0 20px #FFD700',
                  fontWeight: 'bold',
                  marginTop: '15px'
                }}>
                  ✨ ¡NUEVO RÉCORD PERSONAL! ✨
                </div>
              ) : (
                <div style={{ fontSize: '18px', color: '#888', marginTop: '10px' }}>
                  Tu récord anterior: {victoryData.previousBestScore.toLocaleString()} XP
                </div>
              )}
            </div>
            
            {/* Posición en Ranking */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.6)',
              padding: '25px',
              borderRadius: '15px',
              border: '2px solid #FFD700'
            }}>
              <div style={{ fontSize: '24px', color: '#888', marginBottom: '10px' }}>
                Ranking Mundial
              </div>
              <div style={{ 
                fontSize: '48px', 
                color: '#FFD700', 
                fontWeight: 'bold',
                textShadow: '0 0 20px #FFD700'
              }}>
                {victoryData.position === 1 && '🥇 '}
                {victoryData.position === 2 && '🥈 '}
                {victoryData.position === 3 && '🥉 '}
                Posición #{victoryData.position}
              </div>
            </div>
            
            {/* Caja de Rebirth */}
            <div style={{
              background: 'rgba(255, 0, 0, 0.2)',
              padding: '25px',
              borderRadius: '15px',
              marginTop: '30px',
              border: '2px solid #ff3366',
              boxShadow: '0 0 20px rgba(255, 51, 102, 0.4)'
            }}>
              <div style={{ 
                fontSize: '32px', 
                marginBottom: '15px',
                filter: 'drop-shadow(0 0 10px rgba(255, 51, 102, 0.8))'
              }}>
                ♻️
              </div>
              <h3 style={{ 
                color: '#ff3366', 
                fontSize: '24px',
                marginBottom: '15px',
                textShadow: '0 0 15px #ff3366'
              }}>
                ¿Querés mejorar tu marca?
              </h3>
              <p style={{ 
                color: '#fff', 
                fontSize: '16px',
                marginBottom: '10px',
                lineHeight: '1.6'
              }}>
                Hacé <strong>Rebirth</strong> para volver a nivel 1
              </p>
              <p style={{ 
                color: '#00ff88', 
                fontSize: '18px',
                marginBottom: '20px',
                fontWeight: 'bold',
                textShadow: '0 0 10px #00ff88'
              }}>
                ✨ Ventaja: Todos los upgrades empiezan en nivel {rebirthCount + 1} ✨
              </p>
            </div>
            
            {/* Botones */}
            <div style={{ 
              display: 'flex', 
              gap: '20px', 
              justifyContent: 'center',
              marginTop: '40px',
              flexWrap: 'wrap'
            }}>
              <button 
                onClick={handleRebirth}
                style={{
                  background: 'transparent',
                  border: '3px solid #ff3366',
                  color: '#ff3366',
                  padding: '20px 40px',
                  fontSize: '24px',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  textShadow: '0 0 10px #ff3366',
                  boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)',
                  transition: 'all 0.3s',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 51, 102, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                <span style={{ fontSize: '28px' }}>♻️</span> REBIRTH
              </button>
              
              <button 
                onClick={() => {
                  setGameState('menu');
                  setVictoryData(null);
                }}
                style={{
                  background: 'transparent',
                  border: '3px solid #FFD700',
                  color: '#FFD700',
                  padding: '20px 50px',
                  fontSize: '24px',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  textShadow: '0 0 10px #FFD700',
                  boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                  transition: 'all 0.3s',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 215, 0, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                VOLVER AL MENÚ
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #ff3366',
          boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)'
        }}>
          <h2 style={{ color: '#ff3366', textShadow: '0 0 20px #ff3366' }}>
            GAME OVER
          </h2>
          <p style={{ fontSize: '20px' }}>Nivel alcanzado: {level}</p>
          <p style={{ fontSize: '20px' }}>XP Total: {totalXP}</p>
          <button 
            onClick={() => {
              // Save progress before returning to menu
              // NO resetear el nivel - mantener el nivel alcanzado
              saveUserProgress();
              setGameState('menu');
            }}
            style={{
              background: 'transparent',
              border: '2px solid #ff3366',
              color: '#ff3366',
              padding: '15px 40px',
              fontSize: '24px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #ff3366',
              marginTop: '20px'
            }}
          >
            VOLVER AL MENÚ
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            style={{
              width: '100%',
              height: '100%',
              border: isMobile ? '2px solid #33ffff' : '3px solid #33ffff',
              boxShadow: isMobile ? '0 0 20px rgba(51, 255, 255, 0.4)' : '0 0 40px rgba(51, 255, 255, 0.4)',
              borderRadius: '0',
              display: 'block',
              imageRendering: 'pixelated',
              touchAction: 'none', // Prevent default touch behaviors
              WebkitTouchCallout: 'none', // Prevent iOS callout
              WebkitUserSelect: 'none', // Prevent text selection
              userSelect: 'none'
            }}
          />
          
          {/* Mobile Controls */}
          {isMobile && gameState === 'playing' && (
            <>
              {/* Joystick - Bottom Right */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  right: '20px',
                  width: '120px',
                  height: '120px',
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              >
                {/* Joystick Base */}
                <div
                  style={{
                    position: 'absolute',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: 'rgba(51, 255, 255, 0.2)',
                    border: '2px solid rgba(51, 255, 255, 0.5)',
                    boxShadow: '0 0 20px rgba(51, 255, 255, 0.3)',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
                {/* Joystick Handle */}
                <div
                  style={{
                    position: 'absolute',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: joystickActive 
                      ? 'rgba(51, 255, 255, 0.9)' 
                      : 'rgba(51, 255, 255, 0.4)',
                    border: '2px solid #33ffff',
                    boxShadow: joystickActive 
                      ? '0 0 20px rgba(51, 255, 255, 0.8)' 
                      : '0 0 10px rgba(51, 255, 255, 0.4)',
                    left: joystickActive && (joystickDirection.x !== 0 || joystickDirection.y !== 0)
                      ? `${60 + joystickDirection.x * 35}px`
                      : '50%',
                    top: joystickActive && (joystickDirection.x !== 0 || joystickDirection.y !== 0)
                      ? `${60 + joystickDirection.y * 35}px`
                      : '50%',
                    transform: 'translate(-50%, -50%)',
                    transition: joystickActive ? 'none' : 'all 0.2s ease-out',
                    pointerEvents: 'none'
                  }}
                />
              </div>

              {/* Shoot Button - Bottom Left */}
              {cannonLevel > 0 && (
                <button
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (!isShootingRef.current && shootBulletRef.current) {
                      isShootingRef.current = true;
                      shootBulletRef.current(); // Disparo inmediato
                      if (startAutoFireRef.current) startAutoFireRef.current(); // Iniciar auto-fire
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  onTouchCancel={(e) => {
                    e.stopPropagation();
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '25px',
                    left: '25px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(255, 51, 102, 0.6)',
                    border: '2px solid rgba(255, 51, 102, 0.8)',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 0 15px rgba(255, 51, 102, 0.4)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none',
                    transition: 'all 0.1s ease',
                    fontSize: '0',
                    padding: '0'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!isShootingRef.current && shootBulletRef.current) {
                      isShootingRef.current = true;
                      shootBulletRef.current(); // Disparo inmediato
                      if (startAutoFireRef.current) startAutoFireRef.current(); // Iniciar auto-fire
                    }
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  onMouseLeave={(e) => {
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  title="Disparar (mantener para auto-fire)"
                />
              )}
            </>
          )}
          
          {shopOpen && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.95)',
              padding: '40px',
              borderRadius: '10px',
              border: '3px solid #ff00ff',
              boxShadow: '0 0 40px rgba(255, 0, 255, 0.5)',
              zIndex: 1000,
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h2 style={{ color: '#ff00ff', textShadow: '0 0 20px #ff00ff', textAlign: 'center' }}>
                TIENDA
              </h2>
              <p style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center' }}>
                XP Total: {totalXP} | ⭐ Total: {totalStars}
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                {/* Escudo */}
                {(() => {
                  const next = getNextUpgrade('shield');
                  const currentLevel = shieldLevel;
                  return (
                <div style={{ 
                  border: '2px solid #6495ed', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(100, 149, 237, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Shield size={48} style={{ color: '#6495ed', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#6495ed', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        ESCUDO {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                      border: '2px solid #6495ed',
                      color: '#6495ed',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Imán XP */}
                {(() => {
                  const next = getNextUpgrade('magnet');
                  const currentLevel = magnetLevel;
                  return (
                    <div style={{ 
                      border: '2px solid #00ff88', 
                      padding: '20px', 
                      borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Magnet size={48} style={{ color: '#00ff88', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#00ff88', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        IMÁN XP {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                              border: '2px solid #00ff88',
                              color: '#00ff88',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Cañón */}
                {(() => {
                  const next = getNextUpgrade('cannon');
                  const currentLevel = cannonLevel;
                  return (
                <div style={{ 
                      border: '2px solid #ffff00', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(255, 255, 0, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Sparkles size={48} style={{ color: '#ffff00', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#ffff00', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        CAÑÓN {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                              border: '2px solid #ffff00',
                              color: '#ffff00',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Velocidad */}
                {(() => {
                  const next = getNextUpgrade('speed');
                  const currentLevel = speedLevel;
                  return (
                <div style={{ 
                      border: '2px solid #ff3366', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(255, 51, 102, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Gauge size={48} style={{ color: '#ff3366', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#ff3366', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        VELOCIDAD {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                              border: '2px solid #ff3366',
                              color: '#ff3366',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Velocidad de Bala */}
                {(() => {
                  const next = getNextUpgrade('bullet_speed');
                  const currentLevel = bulletSpeedLevel;
                  return (
                <div style={{ 
                      border: '2px solid #00ff00', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Sparkles size={48} style={{ color: '#00ff00', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#00ff00', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        VELOCIDAD BALA {currentLevel > 0 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                              border: '2px solid #00ff00',
                              color: '#00ff00',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Puntos de Vida */}
                {(() => {
                  const next = getNextUpgrade('health');
                  const currentLevel = healthLevel;
                  return (
                    <div style={{ 
                      border: '2px solid #ff5050', 
                      padding: '20px', 
                      borderRadius: '10px',
                      background: currentLevel > 0 ? 'rgba(255, 80, 80, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Heart size={48} style={{ color: '#ff5050', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#ff5050', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        VIDA {currentLevel > 0 ? `Nivel ${currentLevel}` : ''} ({2 + currentLevel * 2} ❤️)
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && 'GRATIS'}
                          </p>
                          <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                            style={{
                              background: 'transparent',
                              border: '2px solid #ff5050',
                              color: '#ff5050',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                              borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                              width: '100%',
                              marginTop: '10px'
                            }}
                          >
                            COMPRAR NIVEL {next.level}
                          </button>
                        </>
                      ) : (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}
              </div>

              <button 
                onClick={() => setShopOpen(false)}
                style={{
                  background: 'transparent',
                  border: '2px solid #33ffff',
                  color: '#33ffff',
                  padding: '15px 40px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  display: 'block',
                  margin: '0 auto'
                }}
              >
                CERRAR [J]
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default SnakeGame;