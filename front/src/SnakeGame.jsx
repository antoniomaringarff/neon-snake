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
    hasCentralCell: level >= 2,
    centralCellOpeningSpeed: 0.002 + (level * 0.0005),
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
      centralCellOpeningSpeed: 0.0025,
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
      centralCellOpeningSpeed: 0.003,
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
      centralCellOpeningSpeed: 0.0035,
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
      centralCellOpeningSpeed: 0.004,
    },
  };

  return levelSpecificConfigs[level] || baseConfig;
};

const SnakeGame = ({ user, onLogout, isAdmin = false, isBanned = false }) => {
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
    direction: { x: 0, y: 0 } // Store direction synchronously
  });
  const shootBulletRef = useRef(null);
  const isShootingRef = useRef(false);
  const shootingIntervalRef = useRef(null);
  const startAutoFireRef = useRef(null);
  const stopAutoFireRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // menu, playing, levelComplete, gameOver, shop
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [totalXP, setTotalXP] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [currentLevelStars, setCurrentLevelStars] = useState(0);
  const [currentLevelXP, setCurrentLevelXP] = useState(0);
  const [shieldLevel, setShieldLevel] = useState(0); // 0-10: resistencia visual (ya no afecta vida)
  const [magnetLevel, setMagnetLevel] = useState(0); // 0 = none, 1-5 = 10%, 20%, 30%, 40%, 50%
  const [cannonLevel, setCannonLevel] = useState(0); // 0 = none, 1-5 = diferentes configuraciones
  const [speedLevel, setSpeedLevel] = useState(0); // 0 = none, 1-10 = 10% a 100%
  const [bulletSpeedLevel, setBulletSpeedLevel] = useState(0); // 0 = none, 1-10 = x2, x4, x8, x16, x32, x64, x128, x256, x512, x1024
  const [headLevel, setHeadLevel] = useState(1); // 1 = normal, 2 = double, 3 = triple
  const [healthLevel, setHealthLevel] = useState(0); // 0-10: puntos de vida (0=2, 1=4, 2=6... 10=22)
  const [shopOpen, setShopOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shopConfigs, setShopConfigs] = useState(null); // Configuraciones de la tienda desde la DB
  const [leaderboard, setLeaderboard] = useState([]); // Leaderboard data
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState({}); // Configuraciones de niveles desde la DB
  
  const gameRef = useRef({
    snake: [{ x: 300, y: 300 }],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    food: [],
    stars: [], // New: stars collection
    enemies: [],
    particles: [],
    bullets: [],
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
    maxHealth: 2 // Vida máxima del jugador (basada en healthLevel)
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
          { level: 1, xpCost: 0, starsCost: 5, description: 'Mayor recolección en una área en un 10% extra' },
          { level: 2, xpCost: 0, starsCost: 5, description: 'Mayor recolección en una área en un 20% extra' },
          { level: 3, xpCost: 0, starsCost: 5, description: 'Mayor recolección en una área en un 30% extra' },
          { level: 4, xpCost: 0, starsCost: 10, description: 'Mayor recolección en una área en un 40% extra' },
          { level: 5, xpCost: 0, starsCost: 10, description: 'Mayor recolección en una área en un 50% extra' }
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
          { level: 1, xpCost: 0, starsCost: 3, description: '4 puntos de vida máximos' },
          { level: 2, xpCost: 0, starsCost: 3, description: '6 puntos de vida máximos' },
          { level: 3, xpCost: 0, starsCost: 3, description: '8 puntos de vida máximos' },
          { level: 4, xpCost: 0, starsCost: 5, description: '10 puntos de vida máximos' },
          { level: 5, xpCost: 0, starsCost: 5, description: '12 puntos de vida máximos' },
          { level: 6, xpCost: 0, starsCost: 5, description: '14 puntos de vida máximos' },
          { level: 7, xpCost: 0, starsCost: 8, description: '16 puntos de vida máximos' },
          { level: 8, xpCost: 0, starsCost: 8, description: '18 puntos de vida máximos' },
          { level: 9, xpCost: 0, starsCost: 10, description: '20 puntos de vida máximos' },
          { level: 10, xpCost: 0, starsCost: 10, description: '22 puntos de vida máximos' }
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
      gameRef.current.level = data.currentLevel || 1;
      
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
      if (isAdmin) {
        loadLevelConfigs();
      }
    }
  }, [user?.id, isAdmin]);

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

  // Load leaderboard when in menu or level complete
  useEffect(() => {
    if (gameState === 'menu' || gameState === 'levelComplete') {
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

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const WORLD_WIDTH = 6400; // 8x wider
  const WORLD_HEIGHT = 3600; // 6x taller
  const SNAKE_SIZE = 8;
  const FOOD_SIZE = 6;
  const BORDER_WIDTH = 20;

  // Create food function - moved outside useEffect to be accessible everywhere
    const createFood = (forceColor = null, forceValue = null) => {
      // Rainbow colors: violet (most XP) -> red (least XP)
      const colorTiers = [
        { color: '#9400D3', hue: 280, xp: 10, name: 'violet' },    // Violet - 10 XP
        { color: '#4B0082', hue: 275, xp: 8, name: 'indigo' },     // Indigo - 8 XP  
        { color: '#0000FF', hue: 240, xp: 7, name: 'blue' },       // Blue - 7 XP
        { color: '#00FF00', hue: 120, xp: 5, name: 'green' },      // Green - 5 XP
        { color: '#FFFF00', hue: 60, xp: 4, name: 'yellow' },      // Yellow - 4 XP
        { color: '#FFA500', hue: 39, xp: 3, name: 'orange' },      // Orange - 3 XP
        { color: '#FF0000', hue: 0, xp: 2, name: 'red' }           // Red - 2 XP
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
      
      // Size multiplier: 0.7x to 1.5x
      const sizeMultiplier = 0.7 + Math.random() * 0.8;
      const xpValue = forceValue || Math.round(tier.xp * sizeMultiplier);
      
      return {
        x: Math.random() * (WORLD_WIDTH - 40) + 20,
        y: Math.random() * (WORLD_HEIGHT - 40) + 20,
        value: xpValue,
        color: tier.color,
        hue: tier.hue,
        size: FOOD_SIZE * sizeMultiplier
      };
    };

  // Helper function to create enemies - must be outside useEffect to be accessible
    const createEnemy = (levelConfig, gameLevel = 1) => {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
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
        magnetLevel: getUpgradeLevel(Math.min(5, Math.ceil(maxUpgradeLevel / 2))),
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

    const initGame = () => {
      const game = gameRef.current;
      const levelConfig = getLevelConfig(game.level, levelConfigs);
      
      game.snake = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }];
      game.direction = { x: 1, y: 0 };
      game.nextDirection = { x: 1, y: 0 };
      game.food = Array.from({ length: levelConfig.xpDensity }, createFood);
      game.stars = []; // Reset stars
      game.enemies = Array.from({ length: levelConfig.enemyCount }, () => createEnemy(levelConfig, game.level));
      console.log(`🎮 Inicializando nivel ${game.level} con ${game.enemies.length} enemigos`);
      game.particles = [];
      game.currentXP = 0;
      game.currentStars = 0;
      game.starsNeeded = levelConfig.starsNeeded;
      // Inicializar vida del jugador basada en healthLevel: 0=2, 1=4, 2=6... 10=22
      game.maxHealth = 2 + (healthLevel * 2);
      game.currentHealth = game.maxHealth;
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
        // Outside circle - clamp to edge
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

    const shootBullet = () => {
      const game = gameRef.current;
      if (!game.snake || game.snake.length === 0) {
        console.log('❌ No se puede disparar: no hay snake');
        return;
      }
      
      if (cannonLevel === 0) {
        console.log('❌ No se puede disparar: cannonLevel es 0');
        return;
      }
      
      // Initialize lastPlayerShot if not exists
      if (game.lastPlayerShot === undefined) {
        game.lastPlayerShot = 0;
      }
      
      const currentTime = Date.now();
      
      // Calcular cooldown: base según cannonLevel, reducido por bulletSpeedLevel
      // Base: cannon level 5 = 500ms, otros = 1000ms
      const baseCooldown = cannonLevel === 5 ? 500 : 1000;
      // bulletSpeedLevel reduce el cooldown: nivel 1 = 10% menos, nivel 10 = 90% menos
      const cooldownReduction = bulletSpeedLevel * 0.1; // 10% por nivel
      const cooldown = Math.max(50, baseCooldown * (1 - cooldownReduction)); // Mínimo 50ms
      
      if (currentTime - game.lastPlayerShot < cooldown) {
        return; // Still on cooldown
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
      
      // Velocidad de bala siempre constante (no cambia con bulletSpeedLevel)
      const bulletSpeed = 8;
      
      if (cannonLevel >= 1) {
        // Head cannons (always forward)
        const headBulletCount = cannonLevel >= 2 ? 2 : 1;
        for (let i = 0; i < headBulletCount; i++) {
          const offset = headBulletCount === 2 ? (i === 0 ? -15 : 15) : 0;
        game.bullets.push({
            x: head.x + Math.cos(headPerpAngle) * offset,
            y: head.y + Math.sin(headPerpAngle) * offset,
            vx: game.direction.x * bulletSpeed,
            vy: game.direction.y * bulletSpeed,
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
        food.x = Math.max(BORDER_WIDTH, Math.min(WORLD_WIDTH - BORDER_WIDTH, foodX));
        food.y = Math.max(BORDER_WIDTH, Math.min(WORLD_HEIGHT - BORDER_WIDTH, foodY));
        gameRef.current.food.push(food);
      }
      
      // Create golden stars at the death location (1 propia + las que había comido)
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
        pulseSpeed: 0.05
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
        if (newX < BORDER_WIDTH || newX > WORLD_WIDTH - BORDER_WIDTH) {
          enemy.direction.x *= -1;
          newX = Math.max(BORDER_WIDTH, Math.min(WORLD_WIDTH - BORDER_WIDTH, newX));
        }
        if (newY < BORDER_WIDTH || newY > WORLD_HEIGHT - BORDER_WIDTH) {
          enemy.direction.y *= -1;
          newY = Math.max(BORDER_WIDTH, Math.min(WORLD_HEIGHT - BORDER_WIDTH, newY));
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
          x: Math.max(BORDER_WIDTH, Math.min(WORLD_WIDTH - BORDER_WIDTH, newX)),
          y: Math.max(BORDER_WIDTH, Math.min(WORLD_HEIGHT - BORDER_WIDTH, newY))
        });

        if (enemy.segments.length > enemy.length) {
          enemy.segments.pop();
        }
        
        // Aplicar efecto magneto del enemigo para atraer comida
        const enemyMagnetLevel = enemy.magnetLevel || 0;
        if (enemyMagnetLevel > 0) {
          const baseMagnetRange = 100; // Rango base más pequeño que el jugador
          const magnetBonus = (enemyMagnetLevel * 10) / 100; // 10% por nivel
          const magnetRange = baseMagnetRange * (1 + magnetBonus);
          
          game.food.forEach(food => {
            const dx = head.x - food.x;
            const dy = head.y - food.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < magnetRange && distance > 0) {
              // Atraer comida hacia el enemigo
              const attractionStrength = (1 - distance / magnetRange) * 0.2; // Un poco más débil que el jugador
              food.x += (dx / distance) * attractionStrength * normalizedDelta;
              food.y += (dy / distance) * attractionStrength * normalizedDelta;
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
        // If player head hits enemy body, PLAYER dies
        for (let i = 1; i < enemy.segments.length; i++) {
          if (checkCollision(playerHead, enemy.segments[i], game.snakeSize + SNAKE_SIZE)) {
            // Player dies - save session and game over
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            // Use game.sessionXP for score because React state (score) may be outdated
            saveGameSession(game.sessionXP, level, game.sessionXP, duration);
            createParticle(playerHead.x, playerHead.y, '#ff3366', 20);
            setGameState('gameOver');
            return;
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
        
        // Check collision with player (enemy bullets)
        if (bullet.owner === 'enemy' && game.snake.length > 0) {
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
            // Sistema de vida: cabeza -2, cuerpo -1
            const damage = hitHead ? 2 : 1;
            game.currentHealth -= damage;
            
            // Efecto visual
              createParticle(bullet.x, bullet.y, shieldLevel > 0 ? '#6495ed' : '#ff0000', 8);
              
            // Si la vida llega a 0 o menos, el jugador muere
            if (game.currentHealth <= 0) {
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
               bullet.x > 0 && bullet.x < WORLD_WIDTH &&
               bullet.y > 0 && bullet.y < WORLD_HEIGHT;
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
      
      // Apply speed improvement when cursor is close (speedLevel: 1-10 = 10% to 100% extra)
      // Only applies on desktop with mouse
      let currentSpeed = game.baseSpeed;
      if (!isMobile && speedLevel > 0 && distance < 200) {
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

      // Check collision with red borders - instant death
      if (newHead.x < BORDER_WIDTH || newHead.x > WORLD_WIDTH - BORDER_WIDTH ||
          newHead.y < BORDER_WIDTH || newHead.y > WORLD_HEIGHT - BORDER_WIDTH) {
        // Save game session before game over
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
        // Use game.sessionXP for score because React state (score) may be outdated
        saveGameSession(game.sessionXP || 0, level, game.sessionXP || 0, duration);
        setGameState('gameOver');
        return;
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
      game.camera.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, newHead.x - CANVAS_WIDTH / 2));
      game.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, newHead.y - CANVAS_HEIGHT / 2));

      // Apply magnet improvement to attract food (magnetLevel: 1-5 = 10% to 50% extra range)
      if (magnetLevel > 0) {
        const baseMagnetRange = 150;
        const magnetBonus = (magnetLevel * 10) / 100; // 10% per level
        const magnetRange = baseMagnetRange * (1 + magnetBonus);
        
        game.food.forEach(food => {
          const dx = newHead.x - food.x;
          const dy = newHead.y - food.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < magnetRange && distance > 0) {
            // Attract food towards snake
            const attractionStrength = (1 - distance / magnetRange) * 0.3; // Stronger when closer
            food.x += (dx / distance) * attractionStrength * normalizedDelta;
            food.y += (dy / distance) * attractionStrength * normalizedDelta;
            
            // Show particle effect when collecting with magnet
            if (distance < game.snakeSize + food.size + 5) {
              createParticle(food.x, food.y, '#00ff88', 3);
            }
          }
        });
      }

      // Check food collision
      let foodEaten = false;
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
          
          // Recuperar vida al comer estrella (hasta el máximo)
          const previousHealth = game.currentHealth;
          game.currentHealth = Math.min(game.currentHealth + game.maxHealth, game.maxHealth);
          if (game.currentHealth > previousHealth) {
            console.log(`❤️ Vida recuperada: ${previousHealth} → ${game.currentHealth}/${game.maxHealth}`);
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
        
        setGameState('levelComplete');
      }

      updateEnemies(normalizedDelta);

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
        ctx.lineTo(WORLD_WIDTH - camX, BORDER_WIDTH / 2 - camY);
        ctx.stroke();
      }
      
      // Bottom border
      if (camY + CANVAS_HEIGHT > WORLD_HEIGHT - BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(0 - camX, WORLD_HEIGHT - BORDER_WIDTH / 2 - camY);
        ctx.lineTo(WORLD_WIDTH - camX, WORLD_HEIGHT - BORDER_WIDTH / 2 - camY);
        ctx.stroke();
      }
      
      // Left border
      if (camX < BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(BORDER_WIDTH / 2 - camX, 0 - camY);
        ctx.lineTo(BORDER_WIDTH / 2 - camX, WORLD_HEIGHT - camY);
        ctx.stroke();
      }
      
      // Right border
      if (camX + CANVAS_WIDTH > WORLD_WIDTH - BORDER_WIDTH * 2) {
        ctx.beginPath();
        ctx.moveTo(WORLD_WIDTH - BORDER_WIDTH / 2 - camX, 0 - camY);
        ctx.lineTo(WORLD_WIDTH - BORDER_WIDTH / 2 - camX, WORLD_HEIGHT - camY);
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
      
      game.snake.forEach((seg, i) => {
        const screenX = seg.x - camX;
        const screenY = seg.y - camY;
        const alpha = 1 - (i / game.snake.length) * 0.2;
        
        // Calculate color based on position in snake (gradient)
        const colorProgress = Math.min(i / Math.max(game.snake.length - 1, 1), 1);
        const colorIndex = colorProgress * (snakeColors.length - 1);
        const colorLow = Math.floor(colorIndex);
        const colorHigh = Math.min(colorLow + 1, snakeColors.length - 1);
        const colorMix = colorIndex - colorLow;
        
        const r = Math.round(snakeColors[colorLow].r + (snakeColors[colorHigh].r - snakeColors[colorLow].r) * colorMix);
        const g = Math.round(snakeColors[colorLow].g + (snakeColors[colorHigh].g - snakeColors[colorLow].g) * colorMix);
        const b = Math.round(snakeColors[colorLow].b + (snakeColors[colorHigh].b - snakeColors[colorLow].b) * colorMix);
        
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
        ctx.shadowBlur = 12;
        ctx.shadowColor = segmentColor;
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

      // Draw HUD - Horizontal level bar at the top (compact)
      const barHeight = 30;
      const barPadding = 5;
      
      // === NEON HUD DESIGN ===
      const minimapWidth = 120;
      const minimapX = CANVAS_WIDTH - minimapWidth - 10;
      
      // HUD Container with neon border
      const hudX = 8;
      const hudY = 8;
      const hudWidth = 420;
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
      const playerMinimapX = minimapX + (game.snake[0].x / WORLD_WIDTH) * minimapWidth;
      const playerMinimapY = minimapY + (game.snake[0].y / WORLD_HEIGHT) * minimapHeight;
      
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
          const enemyMinimapX = minimapX + (enemyHead.x / WORLD_WIDTH) * minimapWidth;
          const enemyMinimapY = minimapY + (enemyHead.y / WORLD_HEIGHT) * minimapHeight;
          
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
        ctx.fillStyle = '#ffff00';
        ctx.fillText('[ESPACIO] Disparar', 120, CANVAS_HEIGHT - 15);
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
  }, [gameState, shieldLevel, headLevel, cannonLevel, bulletSpeedLevel, shopOpen, showAdminPanel, isAdmin]); // Quitado totalXP de las dependencias

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
    const levelConfig = getLevelConfig(game.level);
    
    // Central rectangle (1 screen size = 800x600) - solo si el nivel lo requiere
    if (levelConfig.hasCentralCell) {
      const centralRect = {
        x: WORLD_WIDTH / 2 - CANVAS_WIDTH / 2,
        y: WORLD_HEIGHT / 2 - CANVAS_HEIGHT / 2,
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
    
    // Create regular food across the map - usar densidad del nivel
    game.food = Array.from({ length: levelConfig.xpDensity }, () => createFood());
    
    // Add yellow/orange orbs inside central rectangle (solo si existe)
    if (game.centralRect) {
      const centralFoodCount = Math.floor(levelConfig.xpDensity * 0.3); // 30% de la comida en el centro
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
    console.log(`🎮 Iniciando juego nivel ${level} con ${game.enemies.length} enemigos`);
    
    // Spawn player: lejos del borde, lejos de enemigos, fuera del centralRect
    const EDGE_MARGIN = 300; // Distancia mínima del borde
    const ENEMY_SAFE_DISTANCE = 200; // Distancia mínima de cualquier enemigo
    
    let spawnX, spawnY;
    let attempts = 0;
    let validSpawn = false;
    
    do {
      // Random position con margen del borde
      spawnX = EDGE_MARGIN + Math.random() * (WORLD_WIDTH - EDGE_MARGIN * 2);
      spawnY = EDGE_MARGIN + Math.random() * (WORLD_HEIGHT - EDGE_MARGIN * 2);
      
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
      let bestX = WORLD_WIDTH / 2;
      let bestY = WORLD_HEIGHT / 2;
      let bestMinDistance = 0;
      
      // Probar varias posiciones y elegir la mejor
      for (let i = 0; i < 20; i++) {
        const testX = EDGE_MARGIN + Math.random() * (WORLD_WIDTH - EDGE_MARGIN * 2);
        const testY = EDGE_MARGIN + Math.random() * (WORLD_HEIGHT - EDGE_MARGIN * 2);
        
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
    game.camera = { 
      x: WORLD_WIDTH / 2 - CANVAS_WIDTH / 2, 
      y: WORLD_HEIGHT / 2 - CANVAS_HEIGHT / 2 
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
    
    const upgrade = upgrades.find(u => u.level === level);
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