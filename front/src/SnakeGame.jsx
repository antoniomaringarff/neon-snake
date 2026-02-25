import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Shield, Zap, Magnet, Gauge, Heart, Palette, Rocket } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import { useTranslation } from './i18n.jsx';

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
      enemyUpgradeLevel: dbConfig.enemyUpgradeLevel ?? Math.floor((level - 1) * 10 / 24),
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
    healthBoxCount: level >= 5 ? Math.min(5, 1 + Math.floor((level - 5) / 2)) : 0,
    enemyUpgradeLevel: Math.floor((level - 1) * 10 / 24), // 0-10 basado en nivel
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

const SnakeGame = ({ user, onLogout, isAdmin = false, isBanned = false, bannedUntil = null, freeShots = false, isImmune = false }) => {
  const canvasRef = useRef(null);
  const { t, lang } = useTranslation();

  // Detectar mobile: pantalla pequeña O dispositivo táctil con pantalla no muy grande
  const detectMobile = () => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const smallScreen = window.innerWidth <= 768 || window.innerHeight <= 500;
    const mediumScreenWithTouch = hasTouch && (window.innerWidth <= 1024 || window.innerHeight <= 768);
    return smallScreen || mediumScreenWithTouch;
  };
  
  const [isMobile, setIsMobile] = useState(detectMobile());
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  
  const trackGaEvent = (eventName, params = {}) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  };

  // Calculate canvas dimensions based on screen size
  // En mobile: usar el tamaño de la pantalla para mostrar más área del mapa
  // En desktop: usar tamaño fijo 800x600
  const getCanvasDimensions = () => {
    const mobile = detectMobile();
    if (mobile) {
      // Mobile landscape: usar todo el espacio disponible menos los controles
      if (window.innerWidth > window.innerHeight) {
        const controlWidth = 120; // Ancho de cada control (izq y der)
        const width = window.innerWidth - (controlWidth * 2) - 20; // Espacio para controles
        const height = window.innerHeight - 50; // Header mínimo
        return { width: Math.floor(width), height: Math.floor(height) };
      }
      // Mobile portrait: dimensiones normales (aunque se mostrará mensaje de rotar)
      const width = window.innerWidth - 4;
      const height = window.innerHeight - 80;
      return { width: Math.floor(width), height: Math.floor(height) };
    }
    return { width: 800, height: 600 };
  };
  
  const [canvasDimensions, setCanvasDimensions] = useState(getCanvasDimensions());
  
  // Update dimensions and orientation on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(detectMobile());
      setIsLandscape(window.innerWidth > window.innerHeight);
      setCanvasDimensions(getCanvasDimensions());
    };
    
    const handleOrientationChange = () => {
      // Pequeño delay para que el navegador actualice las dimensiones
      setTimeout(() => {
        setIsLandscape(window.innerWidth > window.innerHeight);
        setCanvasDimensions(getCanvasDimensions());
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const [gameState, setGameState] = useState('menu'); // menu, playing, levelComplete, gameComplete, gameOver, shop
  const [mobileViewportHeight, setMobileViewportHeight] = useState(null); // Altura visible en móvil (para que los controles no queden ocultos)

  // En móvil al jugar: usar altura visible (visualViewport) para que los controles no queden ocultos por la barra del navegador
  useEffect(() => {
    if (!isMobile || gameState !== 'playing') {
      setMobileViewportHeight(null);
      return;
    }
    const updateHeight = () => {
      if (window.visualViewport) {
        setMobileViewportHeight(window.visualViewport.height);
      }
    };
    updateHeight();
    window.visualViewport?.addEventListener('resize', updateHeight);
    window.visualViewport?.addEventListener('scroll', updateHeight);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('scroll', updateHeight);
    };
  }, [isMobile, gameState]);

  // Al entrar al juego: bloquear scroll y resetear posición (evita pantalla "movida" tras hacer scroll en menú)
  // Al salir: desbloquear y salir de fullscreen
  useEffect(() => {
    if (gameState === 'playing') {
      // Scroll al top para minimizar barra de Safari en iPhone
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Safari iOS: scroll al top tras un delay para forzar que la barra se minimice
      setTimeout(() => { window.scrollTo(0, 1); }, 50);
      setTimeout(() => { window.scrollTo(0, 0); }, 100);
      
      const prevOverflow = document.body.style.overflow;
      const prevDocOverflow = document.documentElement.style.overflow;
      const prevPosition = document.body.style.position;
      const prevTop = document.body.style.top;
      const prevLeft = document.body.style.left;
      const prevRight = document.body.style.right;
      const prevWidth = document.body.style.width;
      const prevHeight = document.body.style.height;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (isMobile) {
        document.body.style.position = 'fixed';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
      }
      return () => {
        document.body.style.overflow = prevOverflow;
        document.documentElement.style.overflow = prevDocOverflow;
        document.body.style.position = prevPosition;
        document.body.style.top = prevTop;
        document.body.style.left = prevLeft;
        document.body.style.right = prevRight;
        document.body.style.width = prevWidth;
        document.body.style.height = prevHeight;
        const exitFS = document.exitFullscreen || document.webkitExitFullscreen;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          exitFS?.call(document);
        }
      };
    } else {
      const exitFS = document.exitFullscreen || document.webkitExitFullscreen;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        exitFS?.call(document);
      }
    }
  }, [gameState, isMobile]);
  
  // Dynamic canvas dimensions
  const CANVAS_WIDTH = canvasDimensions.width;
  const CANVAS_HEIGHT = canvasDimensions.height;
  
  // BASE_UNIT es el tamaño de la pantalla visible (canvas), no la ventana completa
  const BASE_UNIT = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT);
  const SNAKE_SIZE = 8;
  const FOOD_SIZE = 3; // Reducido aún más
  const BORDER_WIDTH = 20;
  
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
  const chatScrollRef = useRef({ shouldAutoScroll: true }); // Track if user wants auto-scroll
  const previousGameStateRef = useRef('menu'); // Track previous gameState
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
  const [showFloatingShop, setShowFloatingShop] = useState(null); // null, 'shop', o 'skins' - tienda flotante durante partida
  const [loading, setLoading] = useState(true);
  const [shopConfigs, setShopConfigs] = useState(null); // Configuraciones de la tienda desde la DB
  const [leaderboard, setLeaderboard] = useState([]); // Leaderboard data por XP
  const [leaderboardByLevel, setLeaderboardByLevel] = useState([]); // Leaderboard data por nivel
  const [leaderboardByRebirth, setLeaderboardByRebirth] = useState([]); // Leaderboard data por rebirths
  const [leaderboardByTotalXP, setLeaderboardByTotalXP] = useState([]); // Leaderboard data por XP total
  const [leaderboardByTotalStars, setLeaderboardByTotalStars] = useState([]); // Leaderboard data por estrellas totales
  const [leaderboardBySeries, setLeaderboardBySeries] = useState([]); // Leaderboard data por serie
  const [chatMessages, setChatMessages] = useState([]); // Chat messages
  const [chatInput, setChatInput] = useState(''); // Chat input text
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [levelConfigs, setLevelConfigs] = useState({}); // Configuraciones de niveles desde la DB
  const [victoryData, setVictoryData] = useState(null); // Datos de victoria nivel 25
  const [rebirthCount, setRebirthCount] = useState(0); // Contador de rebirths
  const [currentSeries, setCurrentSeries] = useState(1); // Serie actual
  const [timeLeft, setTimeLeft] = useState(null); // Tiempo restante del baneo

  // Definición de skins disponibles (debe estar antes de las funciones que lo usan)
  // Categorías: COMÚN, RARO, ÉPICO, MÍTICO, LEGENDARIO, FARMING AURA
  // Se desbloquean por rebirths:
  //   - rebirthCount 0: COMÚN y RARO
  //   - rebirthCount 1: ÉPICO
  //   - rebirthCount 2: MÍTICO
  //   - rebirthCount 3: LEGENDARIO
  //   - rebirthCount 4: FARMING AURA
  const CATEGORY_REBIRTH_REQUIREMENTS = {
    common: 0,
    rare: 0,
    epic: 1,
    mythic: 2,
    legendary: 3,
    farming_aura: 4
  };
  
  const SKINS = {
    // ========== COMÚN (gratis o muy barato) ==========
    rainbow: {
      name: 'Arcoíris',
      description: 'El clásico degradado multicolor',
      xpPrice: 0,
      starsPrice: 0,
      category: 'common',
      colors: [
        { r: 0, g: 255, b: 0 },      // Verde brillante
        { r: 128, g: 255, b: 0 },    // Verde-amarillo
        { r: 255, g: 255, b: 0 },    // Amarillo
        { r: 255, g: 200, b: 0 },    // Amarillo-naranja
        { r: 255, g: 136, b: 0 },    // Naranja
        { r: 255, g: 100, b: 100 },  // Naranja-rosa
        { r: 255, g: 0, b: 255 }     // Rosa/Magenta
      ]
    },
    // ========== COMÚN (solo XP, barato) ==========
    neon_blue: {
      name: 'Neón Azul',
      description: 'Brillo cibernético azul',
      xpPrice: 200,
      starsPrice: 0,
      category: 'common',
      colors: [
        { r: 0, g: 255, b: 255 },    // Cyan
        { r: 0, g: 200, b: 255 },
        { r: 0, g: 150, b: 255 },
        { r: 0, g: 100, b: 255 },
        { r: 50, g: 50, b: 255 },
        { r: 100, g: 0, b: 255 },
        { r: 150, g: 0, b: 200 }     // Púrpura
      ]
    },
    fire: {
      name: 'Fuego',
      description: 'Llamas ardientes',
      xpPrice: 300,
      starsPrice: 0,
      category: 'common',
      colors: [
        { r: 255, g: 255, b: 100 },  // Amarillo claro
        { r: 255, g: 230, b: 0 },    // Amarillo
        { r: 255, g: 180, b: 0 },    // Naranja claro
        { r: 255, g: 120, b: 0 },    // Naranja
        { r: 255, g: 60, b: 0 },     // Naranja rojizo
        { r: 255, g: 0, b: 0 },      // Rojo
        { r: 180, g: 0, b: 0 }       // Rojo oscuro
      ]
    },
    ice: {
      name: 'Hielo',
      description: 'Frío glacial',
      xpPrice: 300,
      starsPrice: 0,
      category: 'common',
      colors: [
        { r: 255, g: 255, b: 255 },  // Blanco
        { r: 200, g: 240, b: 255 },
        { r: 150, g: 220, b: 255 },
        { r: 100, g: 200, b: 255 },
        { r: 50, g: 180, b: 255 },
        { r: 0, g: 150, b: 255 },
        { r: 0, g: 100, b: 200 }     // Azul hielo
      ]
    },
    // ========== RARO (solo XP, moderado) ==========
    toxic: {
      name: 'Tóxico',
      description: 'Veneno radiactivo',
      xpPrice: 400,
      starsPrice: 0,
      category: 'rare',
      colors: [
        { r: 150, g: 255, b: 0 },    // Verde lima
        { r: 100, g: 255, b: 50 },
        { r: 50, g: 255, b: 100 },
        { r: 0, g: 200, b: 100 },
        { r: 0, g: 150, b: 80 },
        { r: 50, g: 100, b: 50 },
        { r: 30, g: 80, b: 30 }      // Verde oscuro
      ]
    },
    galaxy: {
      name: 'Galaxia',
      description: 'Colores del cosmos',
      xpPrice: 500,
      starsPrice: 0,
      category: 'rare',
      colors: [
        { r: 255, g: 100, b: 255 },  // Rosa
        { r: 200, g: 50, b: 255 },   // Púrpura claro
        { r: 150, g: 0, b: 255 },    // Violeta
        { r: 100, g: 0, b: 200 },
        { r: 50, g: 0, b: 150 },
        { r: 0, g: 50, b: 150 },
        { r: 0, g: 100, b: 200 }     // Azul espacial
      ]
    },
    gold: {
      name: 'Oro',
      description: 'Lujo dorado',
      xpPrice: 600,
      starsPrice: 0,
      category: 'rare',
      colors: [
        { r: 255, g: 255, b: 150 },  // Dorado claro
        { r: 255, g: 230, b: 100 },
        { r: 255, g: 215, b: 0 },    // Oro
        { r: 230, g: 190, b: 0 },
        { r: 200, g: 160, b: 0 },
        { r: 180, g: 140, b: 0 },
        { r: 150, g: 120, b: 0 }     // Bronce
      ]
    },
    shadow: {
      name: 'Sombra',
      description: 'Oscuridad pura',
      xpPrice: 700,
      starsPrice: 0,
      category: 'rare',
      colors: [
        { r: 80, g: 80, b: 100 },    // Gris azulado
        { r: 60, g: 60, b: 80 },
        { r: 50, g: 50, b: 70 },
        { r: 40, g: 40, b: 60 },
        { r: 30, g: 30, b: 50 },
        { r: 20, g: 20, b: 40 },
        { r: 10, g: 10, b: 30 }      // Casi negro
      ]
    },
    unicorn: {
      name: 'Unicornio',
      description: 'Mágico y brillante',
      xpPrice: 800,
      starsPrice: 0,
      category: 'rare',
      colors: [
        { r: 255, g: 182, b: 193 },  // Rosa pastel
        { r: 255, g: 218, b: 185 },  // Melocotón
        { r: 255, g: 255, b: 200 },  // Amarillo pastel
        { r: 200, g: 255, b: 200 },  // Verde pastel
        { r: 200, g: 220, b: 255 },  // Azul pastel
        { r: 220, g: 200, b: 255 },  // Lavanda
        { r: 255, g: 200, b: 255 }   // Rosa lavanda
      ]
    },
    // ========== ÉPICO (XP + estrellas) ==========
    matrix: {
      name: 'Matrix',
      description: 'Código verde digital',
      xpPrice: 1000,
      starsPrice: 25,
      category: 'epic',
      colors: [
        { r: 0, g: 255, b: 0 },      // Verde brillante
        { r: 0, g: 230, b: 0 },
        { r: 0, g: 200, b: 0 },
        { r: 0, g: 170, b: 0 },
        { r: 0, g: 140, b: 0 },
        { r: 0, g: 110, b: 0 },
        { r: 0, g: 80, b: 0 }        // Verde oscuro
      ]
    },
    maggie_simpson: {
      name: 'Maggie Simpson',
      description: '¡Chup chup! 🍼',
      xpPrice: 1200,
      starsPrice: 30,
      category: 'epic',
      special: 'pacifier', // Dispara chupetes
      mask: 'maggie',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Simpson (cabeza)
        { r: 100, g: 180, b: 255 },  // Celeste (ropa de bebé)
        { r: 90, g: 170, b: 250 },   // Celeste
        { r: 80, g: 160, b: 245 },   // Celeste
        { r: 70, g: 150, b: 240 },   // Celeste
        { r: 60, g: 140, b: 235 },   // Celeste
        { r: 50, g: 130, b: 230 }    // Celeste
      ]
    },
    lisa_simpson: {
      name: 'Lisa Simpson',
      description: '¡El conocimiento es poder! 📚',
      xpPrice: 1200,
      starsPrice: 30,
      category: 'epic',
      special: 'book', // Dispara libros
      mask: 'lisa',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Simpson (cabeza)
        { r: 255, g: 100, b: 100 },  // Rojo (vestido)
        { r: 250, g: 90, b: 90 },    // Rojo
        { r: 245, g: 80, b: 80 },    // Rojo
        { r: 240, g: 70, b: 70 },    // Rojo
        { r: 235, g: 60, b: 60 },    // Rojo
        { r: 230, g: 50, b: 50 }     // Rojo oscuro
      ]
    },
    bart_simpson: {
      name: 'Bart Simpson',
      description: '¡Lanza rocas! 🪨',
      xpPrice: 1500,
      starsPrice: 35,
      category: 'epic',
      special: 'rock', // Dispara rocas
      mask: 'bart',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Simpson (cabeza)
        { r: 255, g: 140, b: 0 },    // Naranja (remera)
        { r: 255, g: 130, b: 0 },    // Naranja
        { r: 250, g: 120, b: 0 },    // Naranja
        { r: 70, g: 130, b: 180 },   // Azul (short)
        { r: 65, g: 120, b: 170 },   // Azul
        { r: 60, g: 110, b: 160 }    // Azul
      ]
    },
    marge_simpson: {
      name: 'Marge Simpson',
      description: '¡Lanza chuletas! 🥩',
      xpPrice: 1500,
      starsPrice: 35,
      category: 'epic',
      special: 'pork_chop', // Dispara chuletas
      mask: 'marge',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Simpson (cabeza)
        { r: 0, g: 100, b: 200 },    // Verde azulado (pelo)
        { r: 0, g: 90, b: 190 },     // Verde azulado
        { r: 0, g: 80, b: 180 },     // Verde azulado
        { r: 255, g: 255, b: 255 },  // Blanco (vestido)
        { r: 250, g: 250, b: 250 },  // Blanco
        { r: 245, g: 245, b: 245 }   // Blanco
      ]
    },
    // ========== MÍTICO (XP alto + más estrellas) ==========
    minion: {
      name: 'Minion',
      description: '¡Banana! 🍌',
      xpPrice: 1500,
      starsPrice: 40,
      category: 'mythic',
      special: 'banana', // Dispara bananas
      mask: 'minion',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Minion
        { r: 255, g: 210, b: 10 },   // Amarillo
        { r: 250, g: 200, b: 5 },    // Amarillo
        { r: 70, g: 130, b: 180 },   // Azul (overol)
        { r: 65, g: 120, b: 170 },   // Azul
        { r: 60, g: 110, b: 160 },   // Azul
        { r: 55, g: 100, b: 150 }    // Azul oscuro
      ]
    },
    venom: {
      name: 'Venom',
      description: 'Simbionte oscuro 🖤',
      xpPrice: 1800,
      starsPrice: 40,
      category: 'mythic',
      special: 'venom', // Efecto especial: tentáculos negros
      colors: [
        { r: 30, g: 30, b: 30 },     // Negro
        { r: 20, g: 20, b: 25 },
        { r: 15, g: 15, b: 20 },
        { r: 10, g: 10, b: 15 },
        { r: 5, g: 5, b: 10 },
        { r: 255, g: 255, b: 255 },  // Detalles blancos (ojos/dientes)
        { r: 200, g: 200, b: 200 }
      ]
    },
    stormtrooper: {
      name: 'Stormtrooper',
      description: '¡Por el Imperio! 🤖',
      xpPrice: 1800,
      starsPrice: 45,
      category: 'mythic',
      special: 'red_blaster', // Rayos láser rojos
      mask: 'stormtrooper',
      colors: [
        { r: 255, g: 255, b: 255 },  // Blanco
        { r: 240, g: 240, b: 240 },
        { r: 220, g: 220, b: 220 },
        { r: 200, g: 200, b: 200 },
        { r: 30, g: 30, b: 30 },     // Negro (detalles)
        { r: 20, g: 20, b: 20 },
        { r: 10, g: 10, b: 10 }
      ]
    },
    hulk: {
      name: 'Hulk',
      description: '¡HULK APLASTA! 💚',
      xpPrice: 2000,
      starsPrice: 45,
      category: 'mythic',
      special: 'fist', // Efecto especial: puños verdes
      mask: 'hulk', // Pelo negro despeinado
      colors: [
        { r: 100, g: 200, b: 50 },   // Verde claro Hulk
        { r: 80, g: 180, b: 40 },
        { r: 60, g: 160, b: 30 },
        { r: 50, g: 140, b: 25 },
        { r: 40, g: 120, b: 20 },
        { r: 30, g: 100, b: 15 },
        { r: 20, g: 80, b: 10 }      // Verde oscuro
      ]
    },
    captain_america: {
      name: 'Capitán América',
      description: '¡Lanza el escudo! 🛡️',
      xpPrice: 2000,
      starsPrice: 50,
      category: 'mythic',
      special: 'shield', // Efecto especial: escudo como proyectil
      mask: 'captain', // Máscara especial
      colors: [
        { r: 0, g: 80, b: 180 },     // Azul Capitán
        { r: 0, g: 60, b: 150 },
        { r: 255, g: 255, b: 255 },  // Blanco
        { r: 220, g: 220, b: 220 },
        { r: 180, g: 0, b: 0 },      // Rojo
        { r: 150, g: 0, b: 0 },
        { r: 0, g: 40, b: 120 }      // Azul oscuro
      ]
    },
    // ========== LEGENDARIO (muy caro, para veteranos) ==========
    thor: {
      name: 'Thor',
      description: '¡El poder del trueno! ⚡',
      xpPrice: 2500,
      starsPrice: 60,
      category: 'legendary',
      special: 'hammer', // Efecto especial: Mjolnir con rayos
      mask: 'thor', // Casco vikingo
      colors: [
        { r: 200, g: 200, b: 220 },  // Plateado/gris claro
        { r: 150, g: 150, b: 180 },
        { r: 100, g: 100, b: 140 },
        { r: 180, g: 0, b: 0 },      // Capa roja
        { r: 150, g: 0, b: 0 },
        { r: 50, g: 50, b: 80 },
        { r: 30, g: 30, b: 60 }      // Azul oscuro
      ]
    },
    spiderman: {
      name: 'Spider-Man',
      description: '¡Dispara telarañas! 🕷️',
      xpPrice: 7500,
      starsPrice: 200,
      category: 'farming_aura',
      special: 'web', // Efecto especial: telarañas en vez de balas
      colors: [
        { r: 255, g: 0, b: 0 },      // Rojo Spider-Man
        { r: 220, g: 0, b: 20 },
        { r: 180, g: 0, b: 40 },
        { r: 0, g: 50, b: 150 },     // Azul Spider-Man
        { r: 0, g: 30, b: 120 },
        { r: 0, g: 20, b: 100 },
        { r: 0, g: 10, b: 80 }       // Azul oscuro
      ]
    },
    homer_simpson: {
      name: 'Homero Simpson',
      description: '¡Mmm... rosquillas! 🍩',
      xpPrice: 3000,
      starsPrice: 70,
      category: 'legendary',
      special: 'donut', // Dispara rosquillas
      mask: 'homer',
      colors: [
        { r: 255, g: 217, b: 15 },   // Amarillo Simpson (cabeza)
        { r: 255, g: 255, b: 255 },  // Blanco (chomba)
        { r: 250, g: 250, b: 250 },  // Blanco
        { r: 245, g: 245, b: 245 },  // Blanco
        { r: 70, g: 130, b: 180 },   // Azul (pantalón)
        { r: 65, g: 120, b: 170 },   // Azul
        { r: 60, g: 110, b: 160 }    // Azul oscuro
      ]
    },
    gandalf: {
      name: 'Gandalf',
      description: '¡Lanza hechizos blancos! ⚪✨',
      xpPrice: 8000,
      starsPrice: 250,
      category: 'farming_aura',
      special: 'white_spell', // Hechizos blancos tipo balas
      mask: 'gandalf',
      colors: [
        { r: 200, g: 200, b: 200 },  // Gris claro (túnica)
        { r: 180, g: 180, b: 180 },  // Gris
        { r: 160, g: 160, b: 160 },  // Gris
        { r: 140, g: 140, b: 140 },  // Gris
        { r: 255, g: 255, b: 255 },  // Blanco (barba)
        { r: 240, g: 240, b: 240 },  // Blanco
        { r: 220, g: 220, b: 220 }   // Blanco
      ]
    },
    iron_man: {
      name: 'Iron Man',
      description: '¡Yo soy Iron Man! 🤖',
      xpPrice: 4000,
      starsPrice: 90,
      category: 'legendary',
      special: 'repulsor', // Rayos repulsores
      mask: 'ironman',
      colors: [
        { r: 180, g: 0, b: 0 },      // Rojo metálico
        { r: 160, g: 0, b: 0 },
        { r: 255, g: 200, b: 50 },   // Dorado
        { r: 240, g: 180, b: 40 },
        { r: 180, g: 0, b: 0 },      // Rojo
        { r: 255, g: 200, b: 50 },   // Dorado
        { r: 160, g: 0, b: 0 }       // Rojo oscuro
      ]
    },
    harry_potter: {
      name: 'Harry Potter',
      description: '¡Expelliarmus! ⚡🪄',
      xpPrice: 4500,
      starsPrice: 100,
      category: 'legendary',
      special: 'spell', // Efecto especial: hechizos azul/blanco
      mask: 'harry', // Pelo, anteojos, capa y bufanda
      colors: [
        { r: 116, g: 0, b: 1 },      // Rojo Gryffindor
        { r: 148, g: 107, b: 45 },   // Dorado
        { r: 116, g: 0, b: 1 },      // Rojo
        { r: 148, g: 107, b: 45 },   // Dorado
        { r: 30, g: 30, b: 30 },     // Negro (capa)
        { r: 20, g: 20, b: 20 },
        { r: 10, g: 10, b: 10 }
      ]
    },
    darth_vader: {
      name: 'Darth Vader',
      description: '¡Yo soy tu padre! ⚫',
      xpPrice: 5000,
      starsPrice: 120,
      category: 'legendary',
      special: 'sith_laser', // Rayos láser rojos
      mask: 'vader',
      colors: [
        { r: 20, g: 20, b: 20 },     // Negro
        { r: 15, g: 15, b: 15 },
        { r: 10, g: 10, b: 10 },
        { r: 5, g: 5, b: 5 },
        { r: 180, g: 0, b: 0 },      // Rojo (sable)
        { r: 150, g: 0, b: 0 },
        { r: 120, g: 0, b: 0 }
      ]
    }
  };
  
  // Actualizar Spider-Man para incluir máscara
  SKINS.spiderman.mask = 'spiderman';
  
  // Inicializar skin desde localStorage (después de definir SKINS)
  const getInitialSkin = () => {
    if (typeof window === 'undefined') return 'rainbow';
    try {
      const savedSkin = localStorage.getItem('viborita_skin');
      if (savedSkin && SKINS[savedSkin]) {
        return savedSkin;
      }
    } catch (e) {
      console.error('Error loading skin from localStorage:', e);
    }
    return 'rainbow';
  };

  const getInitialUnlockedSkins = () => {
    if (typeof window === 'undefined') return ['rainbow'];
    try {
      const savedUnlockedSkins = localStorage.getItem('viborita_unlocked_skins');
      if (savedUnlockedSkins) {
        const parsed = JSON.parse(savedUnlockedSkins);
        if (Array.isArray(parsed)) {
          return [...new Set(['rainbow', ...parsed])];
        }
      }
    } catch (e) {
      console.error('Error parsing unlocked skins:', e);
    }
    return ['rainbow'];
  };

  const [selectedSkin, setSelectedSkin] = useState(() => getInitialSkin()); // Skin actual
  const [unlockedSkins, setUnlockedSkins] = useState(() => getInitialUnlockedSkins()); // Skins desbloqueados
  const [showSkinSelector, setShowSkinSelector] = useState(false); // Mostrar selector de skins (deprecated, usar activeShopTab)
  const [activeShopTab, setActiveShopTab] = useState('shop'); // 'shop' o 'skins' - pestaña activa en la tienda
  const [lastBoxResult, setLastBoxResult] = useState(null); // Resultado de la última caja abierta
  
  // Función helper para convertir números a texto en español
  const numberToSpanish = (num) => {
    if (num <= 0) return 'cero';
    if (num === 1) return 'Una';
    if (num === 2) return 'Dos';
    if (num === 3) return 'Tres';
    if (num === 4) return 'Cuatro';
    if (num === 5) return 'Cinco';
    if (num === 6) return 'Seis';
    if (num === 7) return 'Siete';
    if (num === 8) return 'Ocho';
    if (num === 9) return 'Nueve';
    if (num === 10) return 'Diez';
    if (num === 11) return 'Once';
    if (num === 12) return 'Doce';
    if (num === 13) return 'Trece';
    if (num === 14) return 'Catorce';
    if (num === 15) return 'Quince';
    if (num === 16) return 'Dieciséis';
    if (num === 17) return 'Diecisiete';
    if (num === 18) return 'Dieciocho';
    if (num === 19) return 'Diecinueve';
    if (num === 20) return 'Veinte';
    if (num <= 30) return `Unos ${num}`;
    // Para números redondos mayores
    if (num % 10 === 0 && num <= 100) {
      const tens = num / 10;
      const tensWords = ['', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa', 'Cien'];
      return tensWords[tens];
    }
    // Para otros números, usar "Unos X"
    return `Unos ${num}`;
  };
  
  // Función para generar mensajes de intro dinámicamente desde la DB (usa t y lang para i18n)
  const getLevelIntroMessage = (levelNum, levelConfigsFromDB, t, lang) => {
    const levelConfig = getLevelConfig(levelNum, levelConfigsFromDB);
    if (!levelConfig || !levelConfig.enemyCount) return null;
    const numStr = (n) => (lang === 'es' ? numberToSpanish(n) : String(n));
    const dangers = [];
    dangers.push(`${levelConfig.enemyCount} ${t('level_intro.danger_enemy_snakes')}`);
    if (levelConfig.structuresCount > 0) {
      if (levelNum === 3) dangers.push(t('level_intro.danger_find_structures'));
      else if (levelNum === 4) dangers.push(t('level_intro.danger_structures_xp'));
      else dangers.push(`${levelConfig.structuresCount} ${t('level_intro.danger_structures')}`);
    } else if (levelNum === 15) {
      dangers.push(t('level_intro.danger_no_structures'));
    }
    if (levelConfig.killerSawCount > 0) {
      dangers.push(`${levelConfig.killerSawCount} ${t('level_intro.danger_killer_saws')}`);
    } else if (levelConfig.killerSawCount === 0 && levelNum >= 9) {
      dangers.push(t('level_intro.danger_saws'));
    }
    if (levelConfig.floatingCannonCount > 0) {
      dangers.push(`${levelConfig.floatingCannonCount} ${t('level_intro.danger_floating_cannons')}`);
    } else if (levelConfig.floatingCannonCount === 0 && levelNum >= 9) {
      dangers.push(t('level_intro.danger_cannons'));
    }
    if (levelConfig.resentfulSnakeCount > 0) {
      if (levelConfig.resentfulSnakeCount === 1) dangers.push(t('level_intro.danger_resentful_one'));
      else dangers.push(`${levelConfig.resentfulSnakeCount} ${t('level_intro.danger_resentful_many')}`);
    } else if (levelConfig.resentfulSnakeCount === 0 && levelNum >= 10) {
      dangers.push(t('level_intro.danger_resentful_label'));
    }
    const shootPercentage = levelConfig.enemyShootPercentage || 0;
    if (shootPercentage > 0) {
      const n = Math.round((levelConfig.enemyCount * shootPercentage) / 100);
      dangers.push(n === 1 ? `${numStr(n)} ${t('level_intro.danger_shoots_one')}` : `${numStr(n)} ${t('level_intro.danger_shoots_many')}`);
    }
    const shieldPercentage = levelConfig.enemyShieldPercentage || 0;
    if (shieldPercentage > 0) {
      const n = Math.round((levelConfig.enemyCount * shieldPercentage) / 100);
      if (n === 2 || n === 3) dangers.push(t('level_intro.danger_shield_2_3'));
      else dangers.push(n === 1 ? `${numStr(n)} ${t('level_intro.danger_shield_one')}` : `${numStr(n)} ${t('level_intro.danger_shield_many')}`);
    }
    if (levelNum === 13 || levelNum === 22) dangers.push(t('level_intro.danger_faster'));
    if (levelNum === 18) dangers.push(t('level_intro.danger_your_speed'));
    if (levelNum === 25) {
      dangers.push(t('level_intro.danger_giant_map'));
      dangers.push(t('level_intro.danger_everything'));
    }
    if (levelNum <= 2) dangers.push(t('level_intro.danger_map_borders'));
    const titleKey = `level_intro.title_${levelNum}`;
    const tipKey = `level_intro.tip_${levelNum}`;
    return {
      title: t(titleKey) !== titleKey ? t(titleKey) : `${t('level_intro.title_fallback')} ${levelNum}`,
      objective: levelConfig.starsNeeded,
      dangers,
      tip: t(tipKey) !== tipKey ? t(tipKey) : t('level_intro.tip_fallback')
    };
  };
  
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

  // Detect mobile screen size - usar detectMobile() consistentemente
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(detectMobile());
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load skins from localStorage on mount (backup, aunque ya se inicializó arriba)
  useEffect(() => {
    const savedSkin = localStorage.getItem('viborita_skin');
    const savedUnlockedSkins = localStorage.getItem('viborita_unlocked_skins');
    
    if (savedSkin && SKINS[savedSkin] && savedSkin !== selectedSkin) {
      setSelectedSkin(savedSkin);
    }
    
    if (savedUnlockedSkins) {
      try {
        const parsed = JSON.parse(savedUnlockedSkins);
        if (Array.isArray(parsed)) {
          // Asegurar que rainbow siempre esté desbloqueado
          setUnlockedSkins([...new Set(['rainbow', ...parsed])]);
        }
      } catch (e) {
        console.error('Error parsing unlocked skins:', e);
      }
    }
  }, []); // Solo ejecutar una vez al montar

  // Save skins to localStorage when they change
  useEffect(() => {
    localStorage.setItem('viborita_skin', selectedSkin);
  }, [selectedSkin]);

  useEffect(() => {
    localStorage.setItem('viborita_unlocked_skins', JSON.stringify(unlockedSkins));
  }, [unlockedSkins]);

  // Sincronizar activeShopTab cuando se cambia gameState o showSkinSelector
  useEffect(() => {
    if (gameState === 'shop') {
      if (showSkinSelector) {
        setActiveShopTab('skins');
      } else if (activeShopTab === 'skins' && !showSkinSelector) {
        // Si estamos en shop pero activeShopTab es skins y showSkinSelector es false, resetear a shop
        setActiveShopTab('shop');
      }
    }
  }, [gameState, showSkinSelector]);

  useEffect(() => {
    if (gameState === 'shop') {
      trackGaEvent('APP/Tienda/Ingreso', {
        tab: activeShopTab
      });
    }
  }, [gameState, activeShopTab]);

  useEffect(() => {
    if (showFloatingShop) {
      trackGaEvent('APP/Tienda/Ingreso/Flotante', {
        tab: showFloatingShop
      });
    }
  }, [showFloatingShop]);

  // Load level configurations from API
  const loadLevelConfigs = async () => {
    try {
      // Use public endpoint for all users, admin endpoint only for editing
      const response = await fetch('/api/users/levels', {
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
        ],
        head: [
          { level: 1, xpCost: 0, starsCost: 0, description: 'XP base (1.0x)' },
          { level: 2, xpCost: 500, starsCost: 15, description: 'XP +10% (1.1x)' },
          { level: 3, xpCost: 1000, starsCost: 25, description: 'XP +20% (1.2x)' }
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

  // Load leaderboard by XP
  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=xp&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  // Load leaderboard by level
  const loadLeaderboardByLevel = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=level&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardByLevel(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard by level:', error);
    }
  };

  // Load leaderboard by rebirths
  const loadLeaderboardByRebirth = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=rebirth&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardByRebirth(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard by rebirth:', error);
    }
  };

  // Load leaderboard by total XP
  const loadLeaderboardByTotalXP = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=xptotal&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardByTotalXP(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard by total XP:', error);
    }
  };

  // Load leaderboard by total stars
  const loadLeaderboardByTotalStars = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=stars&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardByTotalStars(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard by total stars:', error);
    }
  };

  // Load leaderboard by series
  const loadLeaderboardBySeries = async () => {
    try {
      const response = await fetch('/api/leaderboard?type=series&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardBySeries(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard by series:', error);
    }
  };

  // Load chat messages
  const loadChatMessages = async () => {
    try {
      const response = await fetch('/api/chat?limit=50');
      if (response.ok) {
        const data = await response.json();
        setChatMessages(data);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !user?.id) return;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: chatInput.trim() })
      });

      if (response.ok) {
        const newMessage = await response.json();
        setChatMessages(prev => [...prev, newMessage]);
        setChatInput('');
        // When user sends a message, always scroll to bottom
        chatScrollRef.current.shouldAutoScroll = true;
        setTimeout(() => {
          const chatContainer = document.getElementById('chat-messages');
          const chatContainerLevel = document.getElementById('chat-messages-level');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
          if (chatContainerLevel) {
            chatContainerLevel.scrollTop = chatContainerLevel.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  };

  // Helper function to check if user is near bottom of chat
  const isNearBottom = (container) => {
    if (!container) return false;
    const threshold = 50; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Auto-scroll chat when new messages arrive, but only if user is near bottom
  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    const chatContainerLevel = document.getElementById('chat-messages-level');
    
    // Only auto-scroll if user is near bottom (or if shouldAutoScroll is true)
    if (chatContainer && chatScrollRef.current.shouldAutoScroll) {
      if (isNearBottom(chatContainer)) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
    if (chatContainerLevel && chatScrollRef.current.shouldAutoScroll) {
      if (isNearBottom(chatContainerLevel)) {
        chatContainerLevel.scrollTop = chatContainerLevel.scrollHeight;
      }
    }
  }, [chatMessages]);

  // Scroll to bottom when gameState changes (changing screens)
  useEffect(() => {
    if (previousGameStateRef.current !== gameState) {
      // User changed screens, scroll to bottom
      chatScrollRef.current.shouldAutoScroll = true;
      setTimeout(() => {
        const chatContainer = document.getElementById('chat-messages');
        const chatContainerLevel = document.getElementById('chat-messages-level');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        if (chatContainerLevel) {
          chatContainerLevel.scrollTop = chatContainerLevel.scrollHeight;
        }
      }, 100);
      previousGameStateRef.current = gameState;
    }
  }, [gameState]);

  // Add scroll listeners to detect manual scrolling
  useEffect(() => {
    const chatContainer = document.getElementById('chat-messages');
    const chatContainerLevel = document.getElementById('chat-messages-level');
    
    const handleScrollMain = () => {
      if (!chatContainer) return;
      // If user scrolls up, disable auto-scroll
      // If user scrolls near bottom, enable auto-scroll
      chatScrollRef.current.shouldAutoScroll = isNearBottom(chatContainer);
    };

    const handleScrollLevel = () => {
      if (!chatContainerLevel) return;
      chatScrollRef.current.shouldAutoScroll = isNearBottom(chatContainerLevel);
    };

    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScrollMain);
    }
    if (chatContainerLevel) {
      chatContainerLevel.addEventListener('scroll', handleScrollLevel);
    }

    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScrollMain);
      }
      if (chatContainerLevel) {
        chatContainerLevel.removeEventListener('scroll', handleScrollLevel);
      }
    };
  }, [gameState]); // Re-run when gameState changes to attach to new containers

  // Load progress on mount
  useEffect(() => {
    loadUserProgress();
  }, [user?.id]);

  // Load leaderboard when in menu, level complete or game complete
  useEffect(() => {
    if (gameState === 'menu' || gameState === 'levelComplete' || gameState === 'gameComplete') {
      loadLeaderboard();
      loadLeaderboardByLevel();
      loadLeaderboardByRebirth();
      loadLeaderboardByTotalXP();
      loadLeaderboardByTotalStars();
      loadLeaderboardBySeries();
      loadChatMessages();
    }
  }, [gameState]);

  // Poll chat messages every 3 seconds when in menu
  useEffect(() => {
    if (gameState !== 'menu' && gameState !== 'levelComplete' && gameState !== 'gameComplete') return;

    loadChatMessages(); // Load immediately
    const interval = setInterval(() => {
      loadChatMessages();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [gameState]);

  // Calcular tiempo restante del baneo
  useEffect(() => {
    if (!isBanned || !bannedUntil) {
      setTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const now = new Date();
      const bannedDate = new Date(bannedUntil);
      const diff = bannedDate - now;

      if (diff <= 0) {
        // El baneo expiró, recargar la página para verificar con el servidor
        window.location.reload();
        return;
      }

      const minutes = Math.floor(diff / 1000 / 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ minutes, seconds });
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [isBanned, bannedUntil]);

  // Auto-save progress ONLY when in safe states (menu, shop, levelComplete, levelIntro)
  // NOT during gameplay - if you refresh mid-game, you lose that session's progress
  useEffect(() => {
    if (loading) return; // Don't save while loading initial data
    
    // Only auto-save when NOT in active gameplay
    const safeStates = ['menu', 'shop', 'levelComplete', 'gameComplete', 'levelIntro'];
    if (!safeStates.includes(gameState)) return;
    
    const timeoutId = setTimeout(() => {
      saveUserProgress();
    }, 1000); // Save 1 second after state change

    return () => clearTimeout(timeoutId);
  }, [gameState, shieldLevel, magnetLevel, cannonLevel, speedLevel, bulletSpeedLevel, healthLevel]);

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
      
      // 8 colores con valores base de XP (valor base se multiplica por tamaño)
      // Tabla de valores: base * 2^(talle-1)
      const colorTiers = [
        { color: '#FF0000', hue: 0, baseXp: 1, name: 'red' },           // Rojo - base 1
        { color: '#FFA500', hue: 39, baseXp: 2, name: 'orange' },       // Naranja - base 2
        { color: '#FFFF00', hue: 60, baseXp: 3, name: 'yellow' },       // Amarillo - base 3
        { color: '#90EE90', hue: 120, baseXp: 4, name: 'lightgreen' },  // Verde claro - base 4
        { color: '#228B22', hue: 140, baseXp: 5, name: 'darkgreen' },   // Verde oscuro - base 5
        { color: '#00BFFF', hue: 195, baseXp: 6, name: 'cyan' },        // Celeste - base 6
        { color: '#0000FF', hue: 240, baseXp: 7, name: 'blue' },        // Azul - base 7
        { color: '#9400D3', hue: 280, baseXp: 8, name: 'violet' }       // Violeta - base 8
      ];
      
      let tier;
      if (forceColor) {
        tier = colorTiers.find(t => t.name === forceColor);
        if (!tier) tier = colorTiers[Math.floor(Math.random() * colorTiers.length)];
      } else {
        // Selección ponderada de color (colores de bajo XP más comunes)
        // Proporción: rojo más común, violeta más raro (5:1)
        const rand = Math.random();
        if (rand < 0.25) tier = colorTiers[0];      // 25% rojo
        else if (rand < 0.45) tier = colorTiers[1]; // 20% naranja
        else if (rand < 0.60) tier = colorTiers[2]; // 15% amarillo
        else if (rand < 0.73) tier = colorTiers[3]; // 13% verde claro
        else if (rand < 0.83) tier = colorTiers[4]; // 10% verde oscuro
        else if (rand < 0.91) tier = colorTiers[5]; // 8% celeste
        else if (rand < 0.97) tier = colorTiers[6]; // 6% azul
        else tier = colorTiers[7];                   // 3% violeta
      }
      
      // 5 tamaños (talle 1-5) con distribución ponderada
      // Los tamaños grandes son más raros (proporción 5:4:3:2:1)
      // Total: 15 partes -> talle1: 5/15, talle2: 4/15, talle3: 3/15, talle4: 2/15, talle5: 1/15
      let sizeIndex; // 0-4 corresponde a talle 1-5
      const sizeRand = Math.random();
      if (sizeRand < 0.333) sizeIndex = 0;        // 33.3% talle 1 (más pequeño)
      else if (sizeRand < 0.600) sizeIndex = 1;   // 26.7% talle 2
      else if (sizeRand < 0.800) sizeIndex = 2;   // 20.0% talle 3
      else if (sizeRand < 0.933) sizeIndex = 3;   // 13.3% talle 4
      else sizeIndex = 4;                          // 6.7% talle 5 (más grande)
      
      // Tamaño visual: talle 1 es pequeño, talle 5 es grande
      const sizeMultiplier = 0.4 + (sizeIndex * 0.2); // 0.4, 0.6, 0.8, 1.0, 1.2
      
      // Calcular XP según tabla: base * 2^(talle-1)
      // Talle 1: base*1, Talle 2: base*2, Talle 3: base*4, Talle 4: base*8, Talle 5: base*16
      const sizeMultiplierXp = Math.pow(2, sizeIndex); // 1, 2, 4, 8, 16
      let xpValue = tier.baseXp * sizeMultiplierXp; // Siempre calcular basado en color y tamaño
      
      // DEBUG: Si se pasó forceValue, mostrar advertencia (ya no lo usamos)
      if (forceValue !== null) {
        console.warn(`⚠️ forceValue=${forceValue} ignorado, usando cálculo: ${tier.baseXp} * ${sizeMultiplierXp} = ${xpValue}`);
      }
      
      const newFood = {
        x: Math.random() * (game.worldWidth - 40) + 20,
        y: Math.random() * (game.worldHeight - 40) + 20,
        value: xpValue,
        color: tier.color,
        hue: tier.hue,
        size: FOOD_SIZE * sizeMultiplier,
        sizeIndex: sizeIndex, // 0-4 corresponde a talle 1-5
        colorName: tier.name  // Para referencia
      };
      
      // DEBUG: Ver qué valor se asigna al crear la comida
      console.log(`🆕 Creando comida: color=${tier.name}, talle=${sizeIndex + 1}, baseXp=${tier.baseXp}, multiplier=${Math.pow(2, sizeIndex)}, value=${xpValue}`);
      
      return newFood;
    };

  // Helper function to create enemies - must be outside useEffect to be accessible
    const createEnemy = (levelConfig, gameLevel = 1) => {
      const game = gameRef.current;
      const x = Math.random() * game.worldWidth;
      const y = Math.random() * game.worldHeight;
      const angle = Math.random() * Math.PI * 2;
    const baseLength = 15 + Math.random() * 20;
    const initialXP = Math.floor(baseLength * 2); // Initial XP based on length
    
    // Sistema de mejoras progresivo según enemyUpgradeLevel del admin (0-10)
    // Este valor se puede controlar desde el admin panel para ecualizar la dificultad
    const getEnemyUpgrades = (level, configUpgradeLevel) => {
      // Usar el valor del admin si está definido, sino calcular del nivel
      const maxUpgradeLevel = configUpgradeLevel ?? Math.min(10, Math.ceil(level / 2.5));
      
      if (maxUpgradeLevel === 0) {
        // Sin mejoras
        return { shieldLevel: 0, cannonLevel: 0, speedLevel: 0, bulletSpeedLevel: 0, magnetLevel: 0, healthLevel: 0 };
      }
      
      // Probabilidad base de tener mejoras: basada en maxUpgradeLevel
      // upgradeLevel 0-1: 20-30%, upgradeLevel 10: 100%
      const upgradeChance = Math.min(1, 0.2 + (maxUpgradeLevel * 0.08));
      
      // Función para determinar el nivel de una mejora
      // Genera valores aleatorios en rango [maxUpgradeLevel-4, maxUpgradeLevel+4] limitados a [0, maxPossible]
      const getUpgradeLevel = (maxPossible) => {
        if (Math.random() > upgradeChance) return 0;
        // Generar valor en torno al maxUpgradeLevel ±4
        const variance = Math.floor(Math.random() * 9) - 4; // -4 a +4
        const targetLevel = maxUpgradeLevel + variance;
        // Limitar a [0, maxPossible]
        return Math.max(0, Math.min(maxPossible, targetLevel));
      };
      
      return {
        shieldLevel: getUpgradeLevel(10),
        cannonLevel: getUpgradeLevel(5),
        speedLevel: getUpgradeLevel(10),
        bulletSpeedLevel: getUpgradeLevel(10),
        magnetLevel: getUpgradeLevel(10),
        healthLevel: getUpgradeLevel(10)
      };
    };
    
    const upgrades = getEnemyUpgrades(gameLevel, levelConfig.enemyUpgradeLevel);
    
    // Vida basada en healthLevel: nivel 0 = 2, nivel 1 = 4, nivel 2 = 6... nivel 10 = 22
    const enemyMaxHealth = 2 + (upgrades.healthLevel * 2);
    
    // Determinar si puede disparar basado en cannonLevel (ya no usa porcentaje random)
    const canShoot = upgrades.cannonLevel > 0;
    // Shield level > 0 significa que tiene escudo (visual)
    const hasShield = upgrades.shieldLevel > 0;
    
    // Velocidad base + bonus por speedLevel (10% por nivel)
    const baseSpeed = levelConfig.enemySpeed + (Math.random() * 0.5);
    const speedBonus = 1 + (upgrades.speedLevel * 0.1);
    
      // Crear segmentos iniciales para que el enemigo sea visible desde el inicio
      const initialSegments = [];
      for (let i = 0; i < Math.min(baseLength, 15); i++) {
        initialSegments.push({
          x: x - Math.cos(angle) * i * 8,
          y: y - Math.sin(angle) * i * 8
        });
      }
      
      return {
        segments: initialSegments,
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

  // Helper function to create Resentful Snake (BOSS-like enemy)
  // Negra con borde arcoíris, dispara doble, agresiva, si te toca muere y reaparece
  const createResentfulSnake = (levelConfig) => {
    const game = gameRef.current;
    const margin = 200;
    const x = margin + Math.random() * (game.worldWidth - margin * 2);
    const y = margin + Math.random() * (game.worldHeight - margin * 2);
    const angle = Math.random() * Math.PI * 2;
    
    return {
      segments: [{ x, y }],
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: levelConfig.enemySpeed * 1.8, // Más rápida
      length: 25 + Math.random() * 10,
      hue: 0,
      rainbowOffset: Math.random() * 360, // Offset para el arcoíris animado
      isResentful: true,
      lastShotTime: 0,
      shootCooldown: 400, // Dispara muy rápido (400ms)
      chaseRange: 800, // Rango de caza más amplio
      bulletSpeed: 10 // Balas más rápidas
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
      
      // Si tiene inmunidad (admin), no recibe daño - efecto visual especial
      if (isImmune) {
        createParticle(x, y, '#00ffff', 8); // Efecto de inmunidad (cyan)
        return false;
      }
      
      // Si está invulnerable temporalmente, no recibe daño
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
      
      // Validar que la skin seleccionada existe
      if (!SKINS[selectedSkin]) {
        console.warn(`Skin "${selectedSkin}" no encontrada, usando rainbow por defecto`);
        setSelectedSkin('rainbow');
        localStorage.setItem('viborita_skin', 'rainbow');
      }
      
      // Update world size based on level map size
      const worldSize = getWorldSize(levelConfig.mapSize);
      game.worldWidth = worldSize;
      game.worldHeight = worldSize;
      
      console.log(`🗺️ Mapa nivel ${game.level}: mapSize=${levelConfig.mapSize}, BASE_UNIT=${BASE_UNIT}, worldSize=${worldSize}px`);
      console.log(`🎨 Skin seleccionada: ${selectedSkin}`);
      
      // Posición inicial del jugador (centro del MUNDO, no del canvas visible)
      // Esto asegura que siempre empiece en una zona segura del mapa
      const playerStartX = worldSize / 2;
      const playerStartY = worldSize / 2;
      game.snake = [{ x: playerStartX, y: playerStartY }];
      
      // Dirección inicial aleatoria para variedad
      const randomAngle = Math.random() * Math.PI * 2;
      game.direction = { 
        x: Math.cos(randomAngle), 
        y: Math.sin(randomAngle) 
      };
      game.nextDirection = { ...game.direction };
      game.food = Array.from({ length: levelConfig.xpPoints }, createFood);
      game.stars = []; // Reset stars
      
      // Crear enemigos asegurándose de que no estén demasiado cerca del jugador al inicio
      const minDistanceFromPlayer = 300; // Distancia mínima del jugador al inicio (aumentada para más seguridad)
      game.enemies = [];
      let attempts = 0;
      const maxAttempts = levelConfig.enemyCount * 10; // Máximo de intentos para evitar loops infinitos
      
      while (game.enemies.length < levelConfig.enemyCount && attempts < maxAttempts) {
        attempts++;
        const enemy = createEnemy(levelConfig, game.level);
        // Verificar distancia del primer segmento del enemigo al jugador
        const dx = enemy.segments[0].x - playerStartX;
        const dy = enemy.segments[0].y - playerStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance >= minDistanceFromPlayer) {
          game.enemies.push(enemy);
        }
      }
      
      // Si no se pudieron crear suficientes enemigos, crear los restantes sin restricción
      while (game.enemies.length < levelConfig.enemyCount) {
        game.enemies.push(createEnemy(levelConfig, game.level));
      }
      
      // Initialize new entities
      game.killerSaws = Array.from({ length: levelConfig.killerSawCount }, () => createKillerSaw(levelConfig));
      game.floatingCannons = Array.from({ length: levelConfig.floatingCannonCount }, () => createFloatingCannon(levelConfig));
      game.resentfulSnakes = Array.from({ length: levelConfig.resentfulSnakeCount }, () => createResentfulSnake(levelConfig));
      game.healthBoxes = Array.from({ length: levelConfig.healthBoxCount }, () => createHealthBox(levelConfig));
      game.structures = [];
      
      console.log(`🎮 Nivel ${game.level} iniciado: ${game.enemies.length} enemigos, ${game.resentfulSnakes?.length || 0} resentidas, mapa ${game.worldWidth}x${game.worldHeight}`);
      game.totalStarsGenerated = 0; // Reset star counter for level
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
      // Invulnerabilidad inicial de 2 segundos (120 frames) para evitar colisiones inmediatas
      game.invulnerable = 120;
      // Aplicar velocidad del nivel
      game.speed = levelConfig.playerSpeed;
      game.baseSpeed = levelConfig.playerSpeed;
      setCurrentLevelXP(0);
      setCurrentLevelStars(0);
      
      // Establecer gameStartTime después de inicializar todo para evitar múltiples inicializaciones
      if (gameRef.current.gameStartTime === null) {
        gameRef.current.gameStartTime = Date.now();
      }
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
      
      // Escape cierra la tienda flotante
      if (e.key === 'Escape' && showFloatingShop) {
        setShowFloatingShop(null);
        return;
      }
      
      // J abre/cierra la tienda flotante durante la partida (solo desktop)
      if (e.key.toLowerCase() === 'j' && gameState === 'playing' && !isMobile) {
        setShowFloatingShop(prev => prev ? null : 'shop');
        return;
      } else if (e.key === ' ' && cannonLevel > 0) {
        e.preventDefault();
        if (!isShootingRef.current && shootBulletRef.current) {
          isShootingRef.current = true;
          shootBulletRef.current(); // Disparo inmediato
          if (startAutoFireRef.current) startAutoFireRef.current(); // Iniciar auto-fire
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (stopAutoFireRef.current) stopAutoFireRef.current();
      }
    };

    const handleMouseDown = (e) => {
      // Don't handle mouse if admin panel is open or shop is open
      if (showAdminPanel || shopOpen) return;
      
      // Solo botón izquierdo (button === 0) y solo si tiene cañón
      if (e.button === 0 && cannonLevel > 0) {
        e.preventDefault();
        if (!isShootingRef.current && shootBulletRef.current) {
          isShootingRef.current = true;
          shootBulletRef.current(); // Disparo inmediato
          if (startAutoFireRef.current) startAutoFireRef.current(); // Iniciar auto-fire
        }
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        if (stopAutoFireRef.current) stopAutoFireRef.current();
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
      
      // Calcular cuántas balas se disparan (costo en XP: mínimo 10 XP por bala desde total XP)
      let bulletCount = 1;
      if (cannonLevel >= 2) bulletCount = 2;
      if (cannonLevel >= 3) bulletCount = 3;
      if (cannonLevel >= 4) bulletCount = 4;
      const xpCostPerBullet = 10;
      const totalXpCost = xpCostPerBullet * bulletCount;
      
      if (!freeShots) {
        if (totalXP < totalXpCost) return;
        setTotalXP(prev => Math.max(0, prev - totalXpCost));
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
      
      // Debug: contar estrellas generadas
      game.totalStarsGenerated = (game.totalStarsGenerated || 0) + starsToCreate;
      console.log(`⭐ Estrella generada! Total generadas: ${game.totalStarsGenerated}, En mapa: ${game.stars.length + starsToCreate}`);
      // Limitar el número de items de comida y el XP por item
      // Cada item de comida debe tener valores históricos: 2, 5, 10, o 15 XP máximo
      const foodCount = Math.min(20, Math.max(5, Math.floor(totalXP / 5))); // 5-20 food items
      const xpPerFoodRaw = Math.floor(totalXP / foodCount);
      // Limitar el XP por comida a valores históricos (máximo 15)
      const xpPerFood = Math.min(15, xpPerFoodRaw);
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
        // Distribuir como pequeña explosión: siempre un radio mínimo para no tapar la caja de vida
        const starAngle = (Math.PI * 2 * i) / starsToCreate + (Math.random() - 0.5) * 0.4;
        const starRadius = starsToCreate > 1 ? 28 + Math.random() * 15 : 22 + Math.random() * 18;
        
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
            
            // Debug: log cuando un enemigo come una estrella
            console.log(`🐍 Enemigo comió estrella! starsEaten ahora: ${enemy.starsEaten}, Estrellas en mapa: ${game.stars.length - 1}`);
            
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
            // Only process if not already marked for death
            if (!enemy.markedForDeath && !enemiesToRemove.includes(enemyIndex)) {
              enemy.markedForDeath = true;
              // Enemy dies - create food and stars (1 propia + las que comió)
              const deathX = enemyHead.x;
              const deathY = enemyHead.y;
              const enemyXP = enemy.totalXP || (enemy.length * 2); // Base XP on length if no XP tracked
              const starsToCreate = 1 + (enemy.starsEaten || 0);
              createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
              createParticle(deathX, deathY, '#ff3366', 15);
              // Caja de vida (1 punto) - explosión: alejada del centro
              const boxAngle = Math.random() * Math.PI * 2;
              const boxDist = 40 + Math.random() * 25;
              game.healthBoxes.push({
                x: deathX + Math.cos(boxAngle) * boxDist,
                y: deathY + Math.sin(boxAngle) * boxDist,
                healthPoints: 1,
                size: 18,
                pulse: 0,
                pulseSpeed: 0.05
              });
              enemiesToRemove.push(enemyIndex);
            }
            break;
          }
        }

        // Enemy head vs Enemy body collisions (enemies can kill each other)
        game.enemies.forEach((otherEnemy, otherIndex) => {
          if (enemyIndex === otherIndex || enemiesToRemove.includes(otherIndex) || otherEnemy.markedForDeath) return;
          
          const otherHead = otherEnemy.segments[0];
          for (let i = 1; i < enemy.segments.length; i++) {
            if (checkCollision(otherHead, enemy.segments[i], SNAKE_SIZE + SNAKE_SIZE)) {
              // Only process if not already marked for death
              if (!otherEnemy.markedForDeath && !enemiesToRemove.includes(otherIndex)) {
                otherEnemy.markedForDeath = true;
                // Other enemy dies - create food and stars (1 propia + las que comió)
                const deathX = otherHead.x;
                const deathY = otherHead.y;
                const enemyXP = otherEnemy.totalXP || (otherEnemy.length * 2);
                const starsToCreate = 1 + (otherEnemy.starsEaten || 0);
                createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
                createParticle(deathX, deathY, '#ff3366', 15);
                // Caja de vida (1 punto) - explosión: alejada del centro
                const boxAngle = Math.random() * Math.PI * 2;
                const boxDist = 40 + Math.random() * 25;
                game.healthBoxes.push({
                  x: deathX + Math.cos(boxAngle) * boxDist,
                  y: deathY + Math.sin(boxAngle) * boxDist,
                  healthPoints: 1,
                  size: 18,
                  pulse: 0,
                  pulseSpeed: 0.05
                });
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
          // Skip if enemy is already marked for death or already hit this frame
          if (!hit && enemy.segments.length > 0 && !enemiesToKill.includes(enemyIndex) && !enemy.markedForDeath) {
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
                if (enemy.currentHealth <= 0 && !enemy.markedForDeath) {
                  enemy.markedForDeath = true; // Prevent duplicate death processing
                  const deathX = enemyHead.x;
                  const deathY = enemyHead.y;
                  const enemyXP = enemy.totalXP || (enemy.length * 2);
                  const starsToCreate = 1 + (enemy.starsEaten || 0);
                  createFoodFromEnemy(deathX, deathY, enemyXP, starsToCreate);
                  createParticle(deathX, deathY, '#ff3366', 15);
                  // Caja de vida (1 punto) - explosión: alejada del centro
                  const boxAngle = Math.random() * Math.PI * 2;
                  const boxDist = 40 + Math.random() * 25;
                  game.healthBoxes.push({
                    x: deathX + Math.cos(boxAngle) * boxDist,
                    y: deathY + Math.sin(boxAngle) * boxDist,
                    healthPoints: 1,
                    size: 18,
                    pulse: 0,
                    pulseSpeed: 0.05
                  });
                  enemiesToKill.push(enemyIndex);
                }
                return;
            }
          }
        });
        
          // Check collision with Resentful Snakes (player bullets)
          if (!hit && game.resentfulSnakes && game.resentfulSnakes.length > 0) {
            game.resentfulSnakes.forEach((snake, snakeIndex) => {
              if (hit || !snake.segments || snake.segments.length === 0) return;
              
              const snakeHead = snake.segments[0];
              let hitHead = false;
              let hitBody = false;
              
              if (checkCollision(bullet, snakeHead, 15)) {
                hitHead = true;
              } else {
                for (let i = 1; i < snake.segments.length; i++) {
                  if (checkCollision(bullet, snake.segments[i], 12)) {
                    hitBody = true;
                    break;
                  }
                }
              }
              
              if (hitHead || hitBody) {
                // La resentful snake recibe daño - necesita varios disparos para morir
                snake.health = snake.health ?? 10; // 10 de vida por defecto
                const damage = hitHead ? 3 : 1; // Cabeza = más daño
                snake.health -= damage;
                
                // Efecto visual arcoíris al recibir daño
                const hue = (snake.rainbowOffset || 0) % 360;
                createParticle(bullet.x, bullet.y, `hsl(${hue}, 100%, 60%)`, 12);
                hit = true;
                
                // Si la resentful snake muere, reaparece en otro lugar
                if (snake.health <= 0) {
                  // Efecto de muerte espectacular
                  for (let p = 0; p < 20; p++) {
                    const particleHue = (hue + p * 18) % 360;
                    createParticle(snakeHead.x, snakeHead.y, `hsl(${particleHue}, 100%, 60%)`, 8);
                  }
                  createParticle(snakeHead.x, snakeHead.y, '#ffffff', 25);
                  
                  // Crear estrella y XP como recompensa
                  createFoodFromEnemy(snakeHead.x, snakeHead.y, 100, 3); // 3 estrellas por matar a la resentful
                  
                  // Dejar caja de vida de 5 puntos - explosión: alejada del centro
                  const boxAngleR = Math.random() * Math.PI * 2;
                  const boxDistR = 45 + Math.random() * 30;
                  game.healthBoxes.push({
                    x: snakeHead.x + Math.cos(boxAngleR) * boxDistR,
                    y: snakeHead.y + Math.sin(boxAngleR) * boxDistR,
                    healthPoints: 5,
                    size: 25,
                    pulse: 0,
                    pulseSpeed: 0.05
                  });
                  
                  // Respawn en otro lugar (lejos del jugador)
                  const playerHead = game.snake[0];
                  let newSpawnX, newSpawnY, attempts = 0;
                  do {
                    const margin = 200;
                    newSpawnX = margin + Math.random() * (game.worldWidth - margin * 2);
                    newSpawnY = margin + Math.random() * (game.worldHeight - margin * 2);
                    const distToPlayer = Math.sqrt(
                      Math.pow(newSpawnX - playerHead.x, 2) + 
                      Math.pow(newSpawnY - playerHead.y, 2)
                    );
                    attempts++;
                    if (distToPlayer > 600 || attempts > 20) break;
                  } while (true);
                  
                  snake.segments = [{ x: newSpawnX, y: newSpawnY }];
                  snake.direction = {
                    x: Math.cos(Math.random() * Math.PI * 2),
                    y: Math.sin(Math.random() * Math.PI * 2)
                  };
                  snake.health = 10; // Reset vida
                  snake.lastShotTime = Date.now();
                  
                  createParticle(newSpawnX, newSpawnY, '#ff00ff', 15);
                }
              }
            });
          }
        
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
      if (gameState !== 'playing' || shopOpen || showFloatingShop) return; // Pause when shop is open

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
          // Head levels: cada nivel agrega 10% de bonus
          // Nivel 1: 1.0x (base), Nivel 2: 1.1x (+10%), Nivel 3: 1.2x (+20%)
          const xpMultiplier = 1 + (headLevel - 1) * 0.1;
          const xpGain = Math.floor(food.value * xpMultiplier);
          
          // DEBUG: Ver qué valor tiene cada comida
          console.log(`🍎 Comida: color=${food.colorName || food.color}, talle=${food.sizeIndex + 1}, value=${food.value}, xpGain=${xpGain}`);
          
          game.currentXP += xpGain;
          game.sessionXP += xpGain;
          setCurrentLevelXP(prev => prev + xpGain);
          // NO sumar a totalXP durante el juego - solo cuando ganas el nivel
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
          // NO sumar a totalStars durante el juego - solo cuando ganas el nivel
          
          // La vida por matar una víbora se recibe al recoger la CAJA DE VIDA, no al recoger la estrella.
          // Estrellas con groupId (de víbora muerta): no curan al recogerlas.
          // Estrellas sin grupo (del mapa/spawn): siguen curando 1 vida al recogerlas.
          if (!star.groupId) {
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
        // ¡VICTORIA! Ahora sí sumamos XP y estrellas ganadas al total
        const earnedXP = game.sessionXP;
        const earnedStars = game.currentStars;
        setTotalXP(prev => prev + earnedXP);
        setTotalStars(prev => prev + earnedStars);
        
        // Incrementar nivel AHORA (no cuando presiona el botón)
        // Así si hace refresh, ya está en el nivel siguiente
        const nextLevelNum = level < 25 ? level + 1 : level;
        setLevel(nextLevelNum);
        
        // Save game session when completing level
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
        saveGameSession(earnedXP, level, earnedXP, duration);
        
        // Guardar progreso inmediatamente (incluyendo el nuevo nivel)
        setTimeout(() => saveUserProgress(), 100);
        
        // Si es el nivel 25, mostrar pantalla especial de victoria
        if (level === 25) {
          // Obtener datos del ranking del usuario
          fetch(`/api/leaderboard/rank/${user.id}`)
            .then(res => res.json())
            .then(data => {
              const previousBestScore = data.bestScore || 0;
              
              setVictoryData({
                score: earnedXP,
                previousBestScore: previousBestScore,
                position: data.rank || '?',
                isNewRecord: earnedXP > previousBestScore,
                series: currentSeries
              });
              setGameState('gameComplete');
            })
            .catch(err => {
              console.error('Error obteniendo ranking:', err);
              // Fallback si falla el endpoint
              setVictoryData({
                score: earnedXP,
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

      // Update Resentful Snakes (BOSS-like enemies - duelo a muerte)
      if (game.resentfulSnakes && game.resentfulSnakes.length > 0) {
        const currentTime = Date.now();
        game.resentfulSnakes.forEach(snake => {
          if (!snake.segments || snake.segments.length === 0) return;
          
          // Animar el arcoíris
          snake.rainbowOffset = (snake.rainbowOffset || 0) + 2;
          
          const snakeHead = snake.segments[0];
          const playerHead = game.snake[0];
          
          if (playerHead) {
            const dx = playerHead.x - snakeHead.x;
            const dy = playerHead.y - snakeHead.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Chase player if in range (rango amplio)
            if (dist < snake.chaseRange) {
              // Aim at player - giro más rápido y agresivo
              const targetDir = { x: dx / dist, y: dy / dist };
              
              // Giro más rápido cuando está cerca
              const turnSpeed = 0.15 + (1 - dist / snake.chaseRange) * 0.1;
              snake.direction.x += (targetDir.x - snake.direction.x) * turnSpeed * normalizedDelta;
              snake.direction.y += (targetDir.y - snake.direction.y) * turnSpeed * normalizedDelta;
              
              // Normalize
              const dirLen = Math.sqrt(snake.direction.x * snake.direction.x + snake.direction.y * snake.direction.y);
              if (dirLen > 0) {
                snake.direction.x /= dirLen;
                snake.direction.y /= dirLen;
              }
              
              // DISPARO DOBLE agresivo
              if (currentTime - snake.lastShotTime > snake.shootCooldown) {
                snake.lastShotTime = currentTime;
                const bulletSpeed = snake.bulletSpeed || 10;
                const spreadAngle = 0.12; // Separación entre las dos balas
                
                // Bala 1 (ligeramente a la izquierda)
                const angle1 = Math.atan2(snake.direction.y, snake.direction.x) - spreadAngle;
                game.bullets.push({
                  x: snakeHead.x + Math.cos(angle1) * 20,
                  y: snakeHead.y + Math.sin(angle1) * 20,
                  vx: Math.cos(angle1) * bulletSpeed,
                  vy: Math.sin(angle1) * bulletSpeed,
                  life: 150,
                  owner: 'enemy'
                });
                
                // Bala 2 (ligeramente a la derecha)
                const angle2 = Math.atan2(snake.direction.y, snake.direction.x) + spreadAngle;
                game.bullets.push({
                  x: snakeHead.x + Math.cos(angle2) * 20,
                  y: snakeHead.y + Math.sin(angle2) * 20,
                  vx: Math.cos(angle2) * bulletSpeed,
                  vy: Math.sin(angle2) * bulletSpeed,
                  life: 150,
                  owner: 'enemy'
                });
                
                // Efecto visual de disparo
                createParticle(snakeHead.x, snakeHead.y, '#ff00ff', 8);
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
            
            // Move snake (más rápida)
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
            
            // DUELO: Si la resentful toca al jugador, ELLA muere y reaparece
            if (dist < game.snakeSize * 2.5) {
              // ¡La víbora resentida murió al tocarte!
              createParticle(snakeHead.x, snakeHead.y, '#ff00ff', 20);
              createParticle(snakeHead.x, snakeHead.y, '#00ffff', 15);
              createParticle(snakeHead.x, snakeHead.y, '#ffffff', 12);
              
              // Dejar caja de vida de 5 puntos - explosión: alejada del centro
              const boxAngleT = Math.random() * Math.PI * 2;
              const boxDistT = 45 + Math.random() * 30;
              game.healthBoxes.push({
                x: snakeHead.x + Math.cos(boxAngleT) * boxDistT,
                y: snakeHead.y + Math.sin(boxAngleT) * boxDistT,
                healthPoints: 5,
                size: 25,
                pulse: 0,
                pulseSpeed: 0.05
              });
              
              // Respawn en otro lugar del mapa (lejos del jugador)
              let newSpawnX, newSpawnY, attempts = 0;
              do {
                const margin = 200;
                newSpawnX = margin + Math.random() * (game.worldWidth - margin * 2);
                newSpawnY = margin + Math.random() * (game.worldHeight - margin * 2);
                const distToPlayer = Math.sqrt(
                  Math.pow(newSpawnX - playerHead.x, 2) + 
                  Math.pow(newSpawnY - playerHead.y, 2)
                );
                attempts++;
                // Asegurar que aparezca lejos del jugador (mínimo 500px)
                if (distToPlayer > 500 || attempts > 20) break;
              } while (true);
              
              // Reset snake position
              snake.segments = [{ x: newSpawnX, y: newSpawnY }];
              snake.direction = {
                x: Math.cos(Math.random() * Math.PI * 2),
                y: Math.sin(Math.random() * Math.PI * 2)
              };
              snake.lastShotTime = currentTime; // Cooldown para no disparar inmediatamente
              
              // Efecto visual en el nuevo spawn
              createParticle(newSpawnX, newSpawnY, '#ff00ff', 10);
              
              // El jugador también recibe un pequeño empujón pero NO daño
              const pushForce = 30;
              if (dist > 0) {
                playerHead.x += (dx / dist) * pushForce;
                playerHead.y += (dy / dist) * pushForce;
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
          glow.addColorStop(0, food.color.replace(')', ', 0.8)').replace('rgb', 'rgba'));
          glow.addColorStop(1, food.color.replace(')', ', 0)').replace('rgb', 'rgba'));
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(screenX, screenY, food.size * 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Food circle
          ctx.fillStyle = food.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = food.color;
          ctx.beginPath();
          ctx.arc(screenX, screenY, food.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw bullets with special skin effects
      const currentSkinData = SKINS[selectedSkin] || SKINS.rainbow;
      game.bullets.forEach(bullet => {
        const screenX = bullet.x - camX;
        const screenY = bullet.y - camY;
        
        if (bullet.owner === 'player' && currentSkinData?.special) {
          ctx.save();
          ctx.translate(screenX, screenY);
          const angle = Math.atan2(bullet.vy, bullet.vx);
          ctx.rotate(angle);
          
          if (currentSkinData.special === 'web') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke(); }
            for (let r = 4; r <= 12; r += 4) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
          } else if (currentSkinData.special === 'shield') {
            const spin = (bullet.x + bullet.y) * 0.1; ctx.rotate(spin - angle);
            ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0050a0'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'hammer') {
            const spin = (bullet.x + bullet.y) * 0.15; ctx.rotate(spin - angle);
            ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-15, -5); ctx.lineTo(-8, 0); ctx.lineTo(-12, 5); ctx.lineTo(-5, 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(15, -5); ctx.lineTo(8, 0); ctx.lineTo(12, 5); ctx.lineTo(5, 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(-3, -14); ctx.lineTo(3, -17); ctx.lineTo(0, -10); ctx.stroke();
            ctx.strokeStyle = '#66ffff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-10, -2); ctx.lineTo(-14, 3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(10, -2); ctx.lineTo(14, 3); ctx.stroke();
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-3, -12, 6, 14);
            ctx.fillStyle = '#654321'; ctx.fillRect(-3, -8, 6, 3); ctx.fillRect(-3, -3, 6, 3);
            ctx.fillStyle = '#708090'; ctx.fillRect(-8, -18, 16, 8);
            ctx.fillStyle = '#505860'; ctx.fillRect(-7, -17, 14, 2);
          } else if (currentSkinData.special === 'fist') {
            ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'spell') {
            ctx.fillStyle = '#6699ff'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'donut') {
            const spin = (bullet.x + bullet.y) * 0.08; ctx.rotate(spin - angle);
            ctx.fillStyle = '#d4a056'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.ellipse(0, -1, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8b6914'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'sith_laser') {
            ctx.fillStyle = '#cc0000'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'repulsor') {
            ctx.fillStyle = '#66ffff'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'red_blaster') {
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff6666'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'blaster') {
            ctx.fillStyle = '#0066ff'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#66aaff'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
          } else if (currentSkinData.special === 'slingshot' || currentSkinData.special === 'rock') {
            const spin = (bullet.x + bullet.y) * 0.1; ctx.rotate(spin - angle);
            // Roca más realista con forma irregular
            ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.arc(-2, -1, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#6a6a6a'; ctx.beginPath(); ctx.arc(2, 1, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI * 2); ctx.fill();
            // Detalles de textura
            ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(-2, -1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(5, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-1, 3); ctx.lineTo(1, 5); ctx.stroke();
          } else if (currentSkinData.special === 'book') {
            const spin = (bullet.x + bullet.y) * 0.05; ctx.rotate(spin - angle);
            ctx.fillStyle = '#8B4513'; ctx.fillRect(-10, -8, 20, 16);
            ctx.fillStyle = '#654321'; ctx.fillRect(-10, -8, 20, 2);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(-8, -6, 16, 12);
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
              ctx.beginPath(); ctx.moveTo(-6, -4 + i * 3); ctx.lineTo(6, -4 + i * 3); ctx.stroke();
            }
          } else if (currentSkinData.special === 'pacifier') {
            const spin = (bullet.x + bullet.y) * 0.08; ctx.rotate(spin - angle);
            ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff1493'; ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff69b4'; ctx.fillRect(-2, 6, 4, 4);
          } else if (currentSkinData.special === 'pork_chop') {
            const spin = (bullet.x + bullet.y) * 0.06; ctx.rotate(spin - angle);
            ctx.fillStyle = '#d4a574'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c49464'; ctx.beginPath(); ctx.ellipse(0, -2, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-6, 3); ctx.lineTo(-4, 1); ctx.lineTo(-2, 4); ctx.lineTo(0, 2); ctx.lineTo(2, 5); ctx.lineTo(4, 3); ctx.lineTo(6, 6); ctx.lineTo(8, 4); ctx.stroke();
          } else if (currentSkinData.special === 'white_spell') {
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffffcc'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff';
            for (let i = 0; i < 6; i++) {
              const a = (Math.PI * 2 * i) / 6;
              ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke();
            }
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        } else if (bullet.owner === 'player') {
          ctx.fillStyle = '#ffff00'; ctx.shadowBlur = 10; ctx.shadowColor = '#ffff00';
          ctx.beginPath(); ctx.arc(screenX, screenY, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';
          ctx.beginPath(); ctx.arc(screenX, screenY, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
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

      // Draw player snake with selected skin colors - versión suave/lisa
      const currentSkin = SKINS[selectedSkin] || SKINS.rainbow;
      const snakeColors = currentSkin.colors;
      
      if (game.snake && game.snake.length > 0) {
        const totalSegments = game.snake.length;
        
        // Función helper para obtener el progreso de color (0 a 1) basado en la posición proporcional
        const getColorProgress = (segmentIndex) => {
          if (totalSegments === 1) return 0;
          // Distribuir colores proporcionalmente a lo largo de toda la serpiente
          return segmentIndex / (totalSegments - 1);
        };
        
        // Función para interpolar entre dos colores
        const lerpColor = (color1, color2, t) => {
          t = Math.max(0, Math.min(1, t)); // Clamp entre 0 y 1
          return {
            r: Math.round(color1.r + (color2.r - color1.r) * t),
            g: Math.round(color1.g + (color2.g - color1.g) * t),
            b: Math.round(color1.b + (color2.b - color1.b) * t)
          };
        };
        
        // Función para obtener el color interpolado en una posición dada
        const getInterpolatedColor = (progress) => {
          if (snakeColors.length === 1) return snakeColors[0];
          
          const colorProgress = progress * (snakeColors.length - 1);
          const colorIndex = Math.floor(colorProgress);
          const nextColorIndex = Math.min(colorIndex + 1, snakeColors.length - 1);
          const t = colorProgress - colorIndex;
          
          return lerpColor(snakeColors[colorIndex], snakeColors[nextColorIndex], t);
        };
        
        // Primero dibujar conexiones entre segmentos para serpiente lisa con gradiente
        for (let i = 0; i < game.snake.length - 1; i++) {
          const seg1 = game.snake[i];
          const seg2 = game.snake[i + 1];
          const screenX1 = seg1.x - camX;
          const screenY1 = seg1.y - camY;
          const screenX2 = seg2.x - camX;
          const screenY2 = seg2.y - camY;
          
          // Obtener colores interpolados para inicio y fin de la línea
          const progress1 = getColorProgress(i);
          const progress2 = getColorProgress(i + 1);
          const color1 = getInterpolatedColor(progress1);
          const color2 = getInterpolatedColor(progress2);
          
          // Crear gradiente lineal para transición suave
          const gradient = ctx.createLinearGradient(screenX1, screenY1, screenX2, screenY2);
          gradient.addColorStop(0, `rgb(${color1.r}, ${color1.g}, ${color1.b})`);
          gradient.addColorStop(1, `rgb(${color2.r}, ${color2.g}, ${color2.b})`);
          
          // Línea gruesa entre segmentos con gradiente
          ctx.strokeStyle = gradient;
          ctx.lineWidth = game.snakeSize * 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(screenX1, screenY1);
          ctx.lineTo(screenX2, screenY2);
          ctx.stroke();
        }
        
        // Luego dibujar los segmentos encima
        game.snake.forEach((segment, index) => {
          const screenX = segment.x - camX;
          const screenY = segment.y - camY;
          
          if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
              screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
            const progress = getColorProgress(index);
            const color = getInterpolatedColor(progress);
            const colorStr = `rgb(${color.r}, ${color.g}, ${color.b})`;
            
            ctx.fillStyle = colorStr;
            ctx.shadowBlur = 8;
            ctx.shadowColor = colorStr;
            ctx.beginPath();
            ctx.arc(screenX, screenY, game.snakeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Draw mask on head
            if (index === 0) {
              // Draw mask on head
              const skinData = SKINS[selectedSkin] || SKINS.rainbow;
              const dir = game.direction; // Define dir before using it
              if (skinData?.mask) {
                ctx.save();
                ctx.translate(screenX, screenY);
                const dir = game.direction;
                const angle = Math.atan2(dir.y, dir.x);
                ctx.rotate(angle);
                const maskSize = game.snakeSize + 2;
                
                if (skinData.mask === 'spiderman') {
                  ctx.fillStyle = '#b30000'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.strokeStyle = '#800000'; ctx.lineWidth = 0.5;
                  for (let w = 0; w < 8; w++) { const wa = (Math.PI * 2 * w) / 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(wa) * maskSize, Math.sin(wa) * maskSize); ctx.stroke(); }
                  ctx.beginPath(); ctx.arc(0, 0, maskSize * 0.5, 0, Math.PI * 2); ctx.stroke();
                  ctx.fillStyle = '#ffffff';
                  ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(7, -6); ctx.lineTo(8, -2); ctx.lineTo(5, 0); ctx.lineTo(2, -1); ctx.closePath(); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(7, 6); ctx.lineTo(8, 2); ctx.lineTo(5, 0); ctx.lineTo(2, 1); ctx.closePath(); ctx.fill();
                } else if (skinData.mask === 'captain') {
                  ctx.fillStyle = '#1a4a8a'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.fillRect(-maskSize, -1.5, maskSize * 2, 3);
                  ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', 4, 0);
                  ctx.fillStyle = '#0a1a30'; ctx.beginPath(); ctx.ellipse(5, -3, 3, 2, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(5, 3, 3, 2, -0.2, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'thor') {
                  ctx.fillStyle = '#8090a0'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#d0d0d0';
                  ctx.beginPath(); ctx.moveTo(-2, -5); ctx.quadraticCurveTo(-5, -9, -1, -12); ctx.quadraticCurveTo(-3, -8, -2, -5); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(-2, 5); ctx.quadraticCurveTo(-5, 9, -1, 12); ctx.quadraticCurveTo(-3, 8, -2, 5); ctx.fill();
                  ctx.fillStyle = '#00ccff'; ctx.beginPath(); ctx.arc(4.5, -3, 1, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(4.5, 3, 1, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'hulk') {
                  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(-2, 0, maskSize + 2, Math.PI * 0.4, Math.PI * 1.6); ctx.fill();
                  ctx.fillStyle = '#4CAF50'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#0a0a0a';
                  ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(7, -4); ctx.lineTo(7, -3); ctx.lineTo(2, -4.5); ctx.closePath(); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(7, 4); ctx.lineTo(7, 3); ctx.lineTo(2, 4.5); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#ff3333'; ctx.beginPath(); ctx.ellipse(5, -3, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(5, 3, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'harry') {
                  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.moveTo(-3, -10); ctx.quadraticCurveTo(-16, 0, -3, 10); ctx.lineTo(-1, 7); ctx.quadraticCurveTo(-12, 0, -1, -7); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#f5d0b5'; ctx.beginPath(); ctx.arc(0, 0, maskSize - 1, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(-1, 0, maskSize, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
                  ctx.strokeStyle = '#4a3728'; ctx.lineWidth = 1.2;
                  ctx.beginPath(); ctx.arc(5, -3, 3.5, 0, Math.PI * 2); ctx.stroke();
                  ctx.beginPath(); ctx.arc(5, 3, 3.5, 0, Math.PI * 2); ctx.stroke();
                  ctx.fillStyle = '#228b22'; ctx.beginPath(); ctx.arc(5.5, -3, 1.6, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5.5, 3, 1.6, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'homer') {
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(-5, -2); ctx.quadraticCurveTo(-10, -4, -8, -8); ctx.stroke();
                  ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(-10, 4, -8, 8); ctx.stroke();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -4, 5, 6, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 4, 5, 6, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(6, -4, 2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(6, 4, 2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.ellipse(9, 0, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'bart') {
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
                  // Pelo puntiagudo
                  ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-4, -10); ctx.lineTo(-2, -8); ctx.lineTo(0, -10); ctx.lineTo(2, -8); ctx.lineTo(4, -10); ctx.lineTo(6, -8); ctx.stroke();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -4, 4, 5, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 4, 4, 5, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(5.5, -4, 1.5, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5.5, 4, 1.5, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'lisa') {
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  // Pelo puntiagudo alto
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-3, -14); ctx.lineTo(-1, -12); ctx.lineTo(1, -14); ctx.lineTo(3, -12); ctx.lineTo(5, -14); ctx.lineTo(7, -10); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -4, 4, 5, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 4, 4, 5, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(5.5, -4, 1.5, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5.5, 4, 1.5, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'maggie') {
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.arc(0, 0, maskSize - 1, 0, Math.PI * 2); ctx.fill();
                  // Chupete
                  ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(0, 3, 3, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -3, 3, 4, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 3, 3, 4, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(5, -3, 1.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5, 3, 1.2, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'marge') {
                  ctx.fillStyle = '#ffd90f'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  // Pelo azul alto
                  ctx.fillStyle = '#0064c8'; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-4, -16); ctx.lineTo(-2, -14); ctx.lineTo(0, -16); ctx.lineTo(2, -14); ctx.lineTo(4, -16); ctx.lineTo(6, -14); ctx.lineTo(8, -16); ctx.lineTo(10, -10); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -4, 4, 5, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 4, 4, 5, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(5.5, -4, 1.5, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5.5, 4, 1.5, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'gandalf') {
                  ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  // Barba blanca larga
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-6, 8, -3, 12); ctx.lineTo(3, 12); ctx.quadraticCurveTo(6, 8, 4, 0); ctx.closePath(); ctx.fill();
                  // Sombrero puntiagudo
                  ctx.fillStyle = '#808080'; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(0, -14); ctx.lineTo(3, -8); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#606060'; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(0, -12); ctx.lineTo(2, -8); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(4, -2, 3, 4, 0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.ellipse(4, 2, 3, 4, -0.2, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(5, -2, 1.2, 0, Math.PI * 2); ctx.fill();
                  ctx.beginPath(); ctx.arc(5, 2, 1.2, 0, Math.PI * 2); ctx.fill();
                } else if (skinData.mask === 'vader') {
                  ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(3, 0, maskSize * 0.6, maskSize * 0.8, 0, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#2a2a2a';
                  ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(7, -4); ctx.lineTo(7, -1.5); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(2, 5); ctx.lineTo(7, 4); ctx.lineTo(7, 1.5); ctx.lineTo(3, 2); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                  ctx.beginPath(); ctx.moveTo(3, -4.5); ctx.lineTo(6, -3.5); ctx.lineTo(6, -2); ctx.lineTo(3.5, -2.5); ctx.closePath(); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(3, 4.5); ctx.lineTo(6, 3.5); ctx.lineTo(6, 2); ctx.lineTo(3.5, 2.5); ctx.closePath(); ctx.fill();
                } else if (skinData.mask === 'ironman') {
                  ctx.fillStyle = '#b30000'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#ffc033'; ctx.beginPath(); ctx.ellipse(3, 0, maskSize * 0.7, maskSize * 0.85, 0, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#66ffff';
                  ctx.beginPath(); ctx.moveTo(4, -4.5); ctx.lineTo(7, -3.5); ctx.lineTo(7.5, -2.5); ctx.lineTo(4.5, -2.5); ctx.closePath(); ctx.fill();
                  ctx.beginPath(); ctx.moveTo(4, 4.5); ctx.lineTo(7, 3.5); ctx.lineTo(7.5, 2.5); ctx.lineTo(4.5, 2.5); ctx.closePath(); ctx.fill();
                  ctx.fillStyle = '#1a1a1a';
                  ctx.beginPath(); ctx.moveTo(7, -1); ctx.lineTo(10, -0.5); ctx.lineTo(10, 0.5); ctx.lineTo(7, 1); ctx.closePath(); ctx.fill();
                } else if (skinData.mask === 'stormtrooper') {
                  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, maskSize, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(4, 0, maskSize * 0.6, maskSize * 0.7, 0, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#000000'; ctx.fillRect(2, -3, 5, 6);
                }
                
                ctx.restore();
              } else {
                // Normal eyes
                const eyeOffset = 5, eyeRadius = 4, pupilRadius = 2;
                const perpX = -dir.y, perpY = dir.x, forwardOffset = 3;
                const leftEyeX = screenX + perpX * eyeOffset + dir.x * forwardOffset;
                const leftEyeY = screenY + perpY * eyeOffset + dir.y * forwardOffset;
                const rightEyeX = screenX - perpX * eyeOffset + dir.x * forwardOffset;
                const rightEyeY = screenY - perpY * eyeOffset + dir.y * forwardOffset;
                
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.beginPath(); ctx.arc(leftEyeX, leftEyeY, pupilRadius, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(rightEyeX, rightEyeY, pupilRadius, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
        });
      }

      // Draw enemies - versión suave/lisa como el jugador
      game.enemies.forEach(enemy => {
        if (!enemy.segments || enemy.segments.length === 0) return;
        
        const enemyColor = `hsl(${enemy.hue || 0}, 100%, 50%)`;
        const enemyColorDark = `hsl(${enemy.hue || 0}, 80%, 35%)`;
        
        // Primero dibujar conexiones entre segmentos para serpiente lisa
        for (let i = 0; i < enemy.segments.length - 1; i++) {
          const seg1 = enemy.segments[i];
          const seg2 = enemy.segments[i + 1];
          const screenX1 = seg1.x - camX;
          const screenY1 = seg1.y - camY;
          const screenX2 = seg2.x - camX;
          const screenY2 = seg2.y - camY;
          
          ctx.strokeStyle = enemyColor;
          ctx.lineWidth = game.snakeSize * 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(screenX1, screenY1);
          ctx.lineTo(screenX2, screenY2);
          ctx.stroke();
        }
        
        // Luego dibujar los segmentos encima
        enemy.segments.forEach((segment, segIndex) => {
          const screenX = segment.x - camX;
          const screenY = segment.y - camY;
          
          // Solo dibujar si está en pantalla
          if (screenX < -50 || screenX > CANVAS_WIDTH + 50 || 
              screenY < -50 || screenY > CANVAS_HEIGHT + 50) return;
          
          // Glow
          ctx.shadowBlur = 8;
          ctx.shadowColor = enemyColor;
          
          // Cuerpo del segmento
          ctx.fillStyle = enemyColor;
          ctx.beginPath();
          ctx.arc(screenX, screenY, game.snakeSize, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.shadowBlur = 0;
          
          // Cabeza con ojos
          if (segIndex === 0) {
            // Escudo si tiene
            if (enemy.hasShield) {
              ctx.strokeStyle = '#00ffff';
              ctx.lineWidth = 2;
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#00ffff';
              ctx.beginPath();
              ctx.arc(screenX, screenY, game.snakeSize + 5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.shadowBlur = 0;
            }
            
            // Ojos blancos
            ctx.fillStyle = '#ffffff';
            const eyeOffset = game.snakeSize * 0.35;
            ctx.beginPath();
            ctx.arc(screenX - eyeOffset, screenY - eyeOffset, 3, 0, Math.PI * 2);
            ctx.arc(screenX + eyeOffset, screenY - eyeOffset, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupilas negras
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(screenX - eyeOffset, screenY - eyeOffset, 1.5, 0, Math.PI * 2);
            ctx.arc(screenX + eyeOffset, screenY - eyeOffset, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      // Draw Resentful Snakes (BOSS-like enemies - 7 colores al inicio, negro en el medio, 7 colores al final)
      if (game.resentfulSnakes && game.resentfulSnakes.length > 0) {
        // Colores del arcoíris (7 colores)
        const rainbowColors = [
          '#ff0000', // Rojo
          '#ff7f00', // Naranja
          '#ffff00', // Amarillo
          '#00ff00', // Verde
          '#0000ff', // Azul
          '#4b0082', // Índigo
          '#9400d3'  // Violeta
        ];
        
        game.resentfulSnakes.forEach(snake => {
          if (!snake.segments || snake.segments.length === 0) return;
          
          const totalSegments = snake.segments.length;
          const colorSegments = 7; // 7 segmentos de color en cada extremo
          
          snake.segments.forEach((seg, i) => {
            const screenX = seg.x - camX;
            const screenY = seg.y - camY;
            
            if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
                screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
              
              let segmentColor;
              let glowColor;
              let hasGlow = false;
              
              // Determinar si es un segmento de color o negro
              if (i < colorSegments) {
                // Primeros 7 segmentos: arcoíris desde la cabeza
                const colorIndex = i % rainbowColors.length;
                segmentColor = rainbowColors[colorIndex];
                glowColor = segmentColor;
                hasGlow = true;
              } else if (i >= totalSegments - colorSegments) {
                // Últimos 7 segmentos: arcoíris hacia la cola
                const colorIndex = (totalSegments - 1 - i) % rainbowColors.length;
                segmentColor = rainbowColors[colorIndex];
                glowColor = segmentColor;
                hasGlow = true;
              } else {
                // Segmentos del medio: negro
                segmentColor = '#0a0a0a';
                glowColor = '#333333';
                hasGlow = false;
              }
              
              // Dibujar segmento
              if (hasGlow) {
                // Segmentos de color con glow
                ctx.shadowBlur = 20;
                ctx.shadowColor = glowColor;
              } else {
                // Segmentos negros sin glow (o glow sutil)
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#222222';
              }
              
              ctx.fillStyle = segmentColor;
              ctx.beginPath();
              ctx.arc(screenX, screenY, game.snakeSize, 0, Math.PI * 2);
              ctx.fill();
              
              // Borde sutil para todos
              ctx.strokeStyle = hasGlow ? 'rgba(255,255,255,0.3)' : 'rgba(50,50,50,0.5)';
              ctx.lineWidth = 1;
              ctx.stroke();
              
              // Ojos furiosos en la cabeza
              if (i === 0) {
                ctx.shadowBlur = 0;
                // Ojos blancos con pupila roja (mirada amenazante)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(screenX - 4, screenY - 2, 4, 0, Math.PI * 2);
                ctx.arc(screenX + 4, screenY - 2, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Pupilas rojas brillantes
                ctx.fillStyle = '#ff0000';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ff0000';
                ctx.beginPath();
                ctx.arc(screenX - 4, screenY - 2, 2, 0, Math.PI * 2);
                ctx.arc(screenX + 4, screenY - 2, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
              }
            }
          });
        });
      }

      // Draw stars - estrella de 5 puntas realista
      game.stars.forEach(star => {
        const screenX = star.x - camX;
        const screenY = star.y - camY;
        
        if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
            screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
          ctx.save();
          ctx.translate(screenX, screenY);
          ctx.rotate((star.rotation || 0) + Date.now() * 0.002); // Rotación animada
          
          const outerRadius = star.size * 1.2;
          const innerRadius = star.size * 0.5;
          const spikes = 5;
          
          // Glow dorado
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#FFD700';
          
          // Dibujar estrella de 5 puntas
          ctx.beginPath();
          for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          
          // Gradiente dorado
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, outerRadius);
          gradient.addColorStop(0, '#FFFFFF');
          gradient.addColorStop(0.3, '#FFFF00');
          gradient.addColorStop(1, '#FFD700');
          ctx.fillStyle = gradient;
          ctx.fill();
          
          // Borde brillante
          ctx.strokeStyle = '#FFA500';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          ctx.restore();
          ctx.shadowBlur = 0;
        }
      });

      // === SIMPLE FLOATING HUD ===
      // Minimapa arriba a la derecha
      const minimapWidth = 100;
      const minimapHeight = 75;
      const minimapX = CANVAS_WIDTH - minimapWidth - 15;
      const minimapY = 15;
      
      // Fondo del minimapa
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(minimapX, minimapY, minimapWidth, minimapHeight, 6);
      ctx.fill();
      
      // Borde neón del minimapa
      ctx.strokeStyle = '#33ffff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#33ffff';
      ctx.beginPath();
      ctx.roundRect(minimapX, minimapY, minimapWidth, minimapHeight, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Jugador en minimapa
      if (game.snake && game.snake.length > 0) {
        const playerHead = game.snake[0];
        const px = minimapX + (playerHead.x / game.worldWidth) * minimapWidth;
        const py = minimapY + (playerHead.y / game.worldHeight) * minimapHeight;
        
        ctx.fillStyle = '#33ffff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#33ffff';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      // Enemigos en minimapa
      game.enemies.forEach(enemy => {
        if (enemy.segments && enemy.segments.length > 0) {
          const head = enemy.segments[0];
          const ex = minimapX + (head.x / game.worldWidth) * minimapWidth;
          const ey = minimapY + (head.y / game.worldHeight) * minimapHeight;
          ctx.fillStyle = `hsl(${enemy.hue || 0}, 100%, 50%)`;
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Estrellas en minimapa
      if (game.stars) {
        ctx.fillStyle = '#FFD700';
        game.stars.forEach(star => {
          const sx = minimapX + (star.x / game.worldWidth) * minimapWidth;
          const sy = minimapY + (star.y / game.worldHeight) * minimapHeight;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      
      // Resentful snakes en minimapa
      if (game.resentfulSnakes && game.resentfulSnakes.length > 0) {
        game.resentfulSnakes.forEach(snake => {
          if (snake.segments && snake.segments.length > 0) {
            const head = snake.segments[0];
            const rx = minimapX + (head.x / game.worldWidth) * minimapWidth;
            const ry = minimapY + (head.y / game.worldHeight) * minimapHeight;
            const hue = (snake.rainbowOffset || 0) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
            ctx.beginPath();
            ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Draw health boxes ON TOP (cajita de primeros auxilios) - blanco y rojo
      if (game.healthBoxes && game.healthBoxes.length > 0) {
        game.healthBoxes.forEach(box => {
          const screenX = box.x - camX;
          const screenY = box.y - camY;
          if (screenX > -80 && screenX < CANVAS_WIDTH + 80 && screenY > -80 && screenY < CANVAS_HEIGHT + 80) {
            ctx.save();
            ctx.translate(screenX, screenY);
            const pulseScale = 1 + (Math.sin(box.pulse || 0) * 0.5 + 0.5) * 0.08;
            ctx.scale(pulseScale, pulseScale);
            const w = Math.max(box.size || 20, 24);
            const h = w * 1.1;
            const corner = w * 0.2;
            // Sombra suave
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(200, 0, 0, 0.6)';
            ctx.shadowOffsetY = 2;
            // Cajita: fondo blanco con bordes redondeados
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, corner);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            // Borde rojo de la cajita
            ctx.strokeStyle = '#c41e3a';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            // Cruz roja (primeros auxilios): barra vertical y horizontal
            const crossW = w * 0.25;
            const crossPad = w * 0.15;
            ctx.fillStyle = '#c41e3a';
            ctx.beginPath();
            ctx.roundRect(-crossW / 2, -h / 2 + crossPad, crossW, h - crossPad * 2, crossW / 4);
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(-w / 2 + crossPad, -crossW / 2, w - crossPad * 2, crossW, crossW / 4);
            ctx.fill();
            // Número de vida en el centro (blanco para leer sobre la cruz)
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(box.healthPoints || 0), 0, 0);
            ctx.restore();
          }
        });
      }
      
    };

    // Game loop
    const gameLoop = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      update(deltaTime);
      draw();
      
      animationId = requestAnimationFrame(gameLoop);
    };

    // Initialize game when starting to play
    // Siempre reiniciar si gameStartTime es null o si no hay enemigos
    // Esto asegura que el juego siempre se reinicie desde cero cuando se inicia una nueva partida
    if (gameState === 'playing' && (gameRef.current.gameStartTime === null || gameRef.current.enemies.length === 0)) {
      initGame();
    }

    // Start game loop - pausar si la tienda flotante está abierta
    if (gameState === 'playing' && !shopOpen && !showFloatingShop) {
      animationId = requestAnimationFrame(gameLoop);
    }

    // Mouse and touch event listeners
    const canvasElement = canvasRef.current;
    if (canvasElement) {
      // Mouse events for desktop
      if (!isMobile) {
        canvasElement.addEventListener('mousemove', handleMouseMove);
        canvasElement.addEventListener('mousedown', handleMouseDown);
        canvasElement.addEventListener('mouseup', handleMouseUp);
      }

      // Touch events
      canvasElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvasElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvasElement.addEventListener('touchend', handleJoystickEnd);
    }

    // Keyboard event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (canvasElement) {
        if (!isMobile) {
          canvasElement.removeEventListener('mousemove', handleMouseMove);
          canvasElement.removeEventListener('mousedown', handleMouseDown);
          canvasElement.removeEventListener('mouseup', handleMouseUp);
        }
        canvasElement.removeEventListener('touchstart', handleTouchStart);
        canvasElement.removeEventListener('touchmove', handleTouchMove);
        canvasElement.removeEventListener('touchend', handleJoystickEnd);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, level, shieldLevel, cannonLevel, bulletSpeedLevel, shopOpen, showFloatingShop, selectedSkin, isImmune, isMobile, totalXP]);

  const startGame = () => {
    // Resetear completamente el estado del juego antes de iniciar
    gameRef.current.gameStartTime = null; // Forzar reinicialización
    gameRef.current.enemies = [];
    gameRef.current.snake = [];
    gameRef.current.food = [];
    gameRef.current.stars = [];
    gameRef.current.bullets = [];
    gameRef.current.particles = [];
    gameRef.current.killerSaws = [];
    gameRef.current.floatingCannons = [];
    gameRef.current.resentfulSnakes = [];
    gameRef.current.healthBoxes = [];
    gameRef.current.structures = [];
    gameRef.current.sessionXP = 0;
    gameRef.current.currentXP = 0;
    gameRef.current.currentStars = 0;
    
    // Formato: APP/Nuevo/Juego/R{rebirthCount}/N{level} (también al iniciar desde el menú)
    trackGaEvent(`APP/Nuevo/Juego/R${rebirthCount}/N${level}`, {
      level,
      rebirth_count: rebirthCount,
      series: currentSeries
    });

    // Mostrar intro del nivel primero
    setGameState('levelIntro');
  };

  const beginLevel = () => {
    // Esta función realmente inicia el juego después de la intro
    // Resetear completamente el estado del juego antes de iniciar
    gameRef.current.gameStartTime = null; // Forzar reinicialización
    gameRef.current.enemies = [];
    gameRef.current.snake = [];
    gameRef.current.food = [];
    gameRef.current.stars = [];
    gameRef.current.bullets = [];
    gameRef.current.particles = [];
    gameRef.current.killerSaws = [];
    gameRef.current.floatingCannons = [];
    gameRef.current.resentfulSnakes = [];
    gameRef.current.healthBoxes = [];
    gameRef.current.structures = [];
    // Resetear dirección para evitar estado residual
    gameRef.current.direction = { x: 1, y: 0 };
    gameRef.current.nextDirection = { x: 1, y: 0 };
    
    // Resetear joystick para evitar movimiento residual
    joystickRef.current.isActive = false;
    joystickRef.current.direction = { x: 0, y: 0 };
    joystickRef.current.intensity = 0;
    setJoystickActive(false);
    setJoystickDirection({ x: 0, y: 0 });
    
    gameRef.current.level = level;
    const levelConfig = getLevelConfig(level, levelConfigs);
    gameRef.current.starsNeeded = levelConfig.starsNeeded;
    gameRef.current.sessionXP = 0;
    gameRef.current.headHits = 0; // Reset head hits counter
    gameRef.current.bodyHits = 0; // Reset body hits counter
    setScore(0);
    setShopOpen(false);
    // Formato: APP/Nuevo/Juego/R{rebirthCount}/N{level}
    trackGaEvent(`APP/Nuevo/Juego/R${rebirthCount}/N${level}`, {
      level,
      rebirth_count: rebirthCount,
      series: currentSeries
    });
    // En móvil: pantalla completa para que se vean los controles (evita que el header del navegador los tape)
      if (isMobile) {
        const el = document.documentElement;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (rfs) {
          rfs.call(el).catch(() => {});
        }
      }
    // NO establecer gameStartTime aquí - se establecerá en initGame después de inicializar todo
    setGameState('playing');
    // initGame se ejecutará dentro del useEffect cuando gameState cambie a 'playing'
  };

  const nextLevel = () => {
    // Mostrar intro del siguiente nivel primero
    const nextLevelNum = level < 25 ? level + 1 : level;
    setLevel(nextLevelNum);
    setGameState('levelIntro');
  };

  const handleRebirth = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}/rebirth`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({})
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
      
      trackGaEvent('APP/Juego/Rebirth', {
        rebirth_count: data.rebirthCount,
        series: data.currentSeries
      });

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

      // Nombre del upgrade en español para el evento
      const upgradeNames = {
        shield: 'Escudo',
        magnet: 'Imán',
        cannon: 'Cañón',
        speed: 'Velocidad',
        bullet_speed: 'Velocidad_Bala',
        head: 'Cabeza',
        health: 'Vida'
      };
      const upgradeName = upgradeNames[type] || type;
      
      trackGaEvent(`APP/Tienda/Compra/${upgradeName}`, {
        upgrade_type: type,
        level,
        xp_cost: cost.xp,
        stars_cost: cost.stars
      });
      
      // NO cerrar la tienda al comprar - el usuario puede querer seguir comprando
      // setShopOpen(false);
      
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

  // Configuración de cajas de botín
  const LOOT_BOXES = [
    {
      id: 'common',
      name: 'Caja Común',
      rarity: 'comun',
      color: '#b0bec5',
      borderColor: '#90a4ae',
      xpCost: 200,
      starsCost: 0,
      xpRange: [50, 150],
      starsRange: [0, 1],
      skinChance: 0.12,
      skinCategories: ['common']
    },
    {
      id: 'uncommon',
      name: 'Caja Poco Común',
      rarity: 'poco_comun',
      color: '#8bc34a',
      borderColor: '#7cb342',
      xpCost: 400,
      starsCost: 1,
      xpRange: [120, 260],
      starsRange: [0, 2],
      skinChance: 0.18,
      skinCategories: ['common', 'rare']
    },
    {
      id: 'rare',
      name: 'Caja Rara',
      rarity: 'rara',
      color: '#00bcd4',
      borderColor: '#00acc1',
      xpCost: 800,
      starsCost: 3,
      xpRange: [250, 500],
      starsRange: [1, 4],
      skinChance: 0.25,
      skinCategories: ['rare']
    },
    {
      id: 'epic',
      name: 'Caja Épica',
      rarity: 'epica',
      color: '#ab47bc',
      borderColor: '#9c27b0',
      xpCost: 1500,
      starsCost: 6,
      xpRange: [500, 1000],
      starsRange: [3, 8],
      skinChance: 0.35,
      skinCategories: ['epic']
    },
    {
      id: 'mythic',
      name: 'Caja Mítica',
      rarity: 'mitica',
      color: '#ff7043',
      borderColor: '#ff5722',
      xpCost: 2600,
      starsCost: 10,
      xpRange: [900, 1800],
      starsRange: [6, 14],
      skinChance: 0.45,
      skinCategories: ['epic', 'mythic']
    },
    {
      id: 'legendary',
      name: 'Caja Legendaria',
      rarity: 'legendaria',
      color: '#ffa000',
      borderColor: '#ff8f00',
      xpCost: 4000,
      starsCost: 18,
      xpRange: [1500, 3000],
      starsRange: [10, 24],
      skinChance: 0.6,
      skinCategories: ['legendary']
    },
    {
      id: 'ultra_legendary',
      name: 'Caja Ultra Legendaria',
      rarity: 'ultra_legendaria',
      color: '#ffd600',
      borderColor: '#ffc400',
      xpCost: 6000,
      starsCost: 30,
      xpRange: [2500, 5000],
      starsRange: [18, 40],
      skinChance: 0.8,
      skinCategories: ['legendary', 'farming_aura']
    }
  ];

  // Para cajas con legendary + farming_aura: probabilidad por categoría (por apertura de caja)
  const FARMING_AURA_SKIN_CHANCE = 0.0001; // 0,01%
  const LEGENDARY_SKIN_CHANCE = 0.02;       // 2%

  const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Skin shop functions
  const buySkin = (skinKey) => {
    const skin = SKINS[skinKey];
    if (!skin) {
      console.error(`Skin "${skinKey}" no encontrada`);
      return;
    }

    // Check if already unlocked
    if (unlockedSkins.includes(skinKey)) {
      setSelectedSkin(skinKey);
      // Guardar inmediatamente en localStorage
      localStorage.setItem('viborita_skin', skinKey);
      const skinName = skin.name || skinKey;
      trackGaEvent(`APP/Tienda/Seleccionar/Skin/${skinName}`, {
        skin_key: skinKey
      });
      return;
    }

    // Check if category is unlocked by rebirth
    const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
    if (rebirthCount < requiredRebirth) {
      console.warn(`Skin "${skinKey}" requiere ${requiredRebirth} rebirth(s). Tienes ${rebirthCount}.`);
      return;
    }

    // Check if user has enough resources (XP y estrellas)
    const xpNeeded = skin.xpPrice || 0;
    const starsNeeded = skin.starsPrice || 0;
    
    if (totalXP >= xpNeeded && totalStars >= starsNeeded) {
      setTotalXP(prev => prev - xpNeeded);
      setTotalStars(prev => prev - starsNeeded);
      setUnlockedSkins(prev => {
        const newUnlocked = [...prev, skinKey];
        // Guardar inmediatamente en localStorage
        localStorage.setItem('viborita_unlocked_skins', JSON.stringify(newUnlocked));
        return newUnlocked;
      });
      setSelectedSkin(skinKey);
      // Guardar inmediatamente en localStorage
      localStorage.setItem('viborita_skin', skinKey);
      // Incluir el nombre de la skin en el evento para tracking de best sellers
      const skinName = skin.name || skinKey;
      trackGaEvent(`APP/Tienda/Compra/Skin/${skinName}`, {
        skin_key: skinKey,
        category: skin.category || 'unknown',
        xp_cost: xpNeeded,
        stars_cost: starsNeeded
      });
      setTimeout(() => saveUserProgress(), 100);
    }
  };

  const selectSkin = (skinKey) => {
    if (!SKINS[skinKey]) {
      console.error(`Skin "${skinKey}" no encontrada`);
      return;
    }
    if (unlockedSkins.includes(skinKey)) {
      setSelectedSkin(skinKey);
      // Guardar inmediatamente en localStorage
      localStorage.setItem('viborita_skin', skinKey);
      const skin = SKINS[skinKey];
      if (skin) {
        const skinName = skin.name || skinKey;
        trackGaEvent(`Tienda/Seleccionar/Skin/${skinName}`, {
          skin_key: skinKey
        });
      }
    } else {
      console.warn(`Intento de seleccionar skin bloqueada: ${skinKey}`);
    }
  };

  // Abrir caja de botín (cajas de la tienda)
  const openLootBox = (boxId) => {
    const config = LOOT_BOXES.find(b => b.id === boxId);
    if (!config) return;

    // Verificar recursos suficientes
    if (totalXP < config.xpCost || totalStars < config.starsCost) {
      console.warn('No hay suficientes recursos para abrir esta caja');
      return;
    }

    // Cobrar costo
    setTotalXP(prev => prev - config.xpCost);
    setTotalStars(prev => prev - config.starsCost);

    // Recompensas básicas
    const xpReward = getRandomInt(config.xpRange[0], config.xpRange[1]);
    const starsReward = getRandomInt(config.starsRange[0], config.starsRange[1]);

    setTotalXP(prev => prev + xpReward);
    setTotalStars(prev => prev + starsReward);

    // Posible skin
    let rewardedSkinKey = null;
    let rewardedSkinName = null;

    const hasLegendaryAndFarmingAura = config.skinCategories &&
      config.skinCategories.includes('legendary') &&
      config.skinCategories.includes('farming_aura');

    if (hasLegendaryAndFarmingAura) {
      // Caja Ultra Legendaria: 0,01% farming_aura, 2% legendary (por apertura)
      const roll = Math.random();
      let poolCandidates = [];
      if (roll < FARMING_AURA_SKIN_CHANCE) {
        poolCandidates = Object.entries(SKINS).filter(([key, skin]) => {
          if (skin.category !== 'farming_aura') return false;
          const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
          return rebirthCount >= requiredRebirth;
        });
      } else if (roll < FARMING_AURA_SKIN_CHANCE + LEGENDARY_SKIN_CHANCE) {
        poolCandidates = Object.entries(SKINS).filter(([key, skin]) => {
          if (skin.category !== 'legendary') return false;
          const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
          return rebirthCount >= requiredRebirth;
        });
      }
      if (poolCandidates.length > 0) {
        const lockedCandidates = poolCandidates.filter(([key]) => !unlockedSkins.includes(key));
        const pool = lockedCandidates.length > 0 ? lockedCandidates : poolCandidates;
        const [skinKey, skin] = pool[Math.floor(Math.random() * pool.length)];
        rewardedSkinKey = skinKey;
        rewardedSkinName = skin.name || skinKey;
        setUnlockedSkins(prev => {
          const newUnlocked = Array.from(new Set([...prev, skinKey]));
          try {
            localStorage.setItem('viborita_unlocked_skins', JSON.stringify(newUnlocked));
          } catch (e) {
            console.error('Error guardando skins desbloqueadas desde caja:', e);
          }
          return newUnlocked;
        });
      }
    } else if (Math.random() < config.skinChance) {
      const allCandidates = Object.entries(SKINS).filter(([key, skin]) => {
        if (!config.skinCategories || !config.skinCategories.length) return true;
        if (!skin.category) return false;
        if (!config.skinCategories.includes(skin.category)) return false;
        const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
        return rebirthCount >= requiredRebirth;
      });

      let poolCandidates = allCandidates;
      if (config.skinCategories && config.skinCategories.includes('farming_aura')) {
        const farmingCandidates = allCandidates.filter(([, skin]) => skin.category === 'farming_aura');
        const otherCandidates = allCandidates.filter(([, skin]) => skin.category !== 'farming_aura');
        if (Math.random() < 0.01 && farmingCandidates.length > 0) {
          poolCandidates = farmingCandidates;
        } else if (otherCandidates.length > 0) {
          poolCandidates = otherCandidates;
        }
      }

      const lockedCandidates = poolCandidates.filter(([key]) => !unlockedSkins.includes(key));
      const pool = lockedCandidates.length > 0 ? lockedCandidates : poolCandidates;

      if (pool.length > 0) {
        const [skinKey, skin] = pool[Math.floor(Math.random() * pool.length)];
        rewardedSkinKey = skinKey;
        rewardedSkinName = skin.name || skinKey;

        setUnlockedSkins(prev => {
          const newUnlocked = Array.from(new Set([...prev, skinKey]));
          try {
            localStorage.setItem('viborita_unlocked_skins', JSON.stringify(newUnlocked));
          } catch (e) {
            console.error('Error guardando skins desbloqueadas desde caja:', e);
          }
          return newUnlocked;
        });
      }
    }

    const result = {
      boxId,
      boxName: config.name,
      rarity: config.rarity,
      xpReward,
      starsReward,
      skinKey: rewardedSkinKey,
      skinName: rewardedSkinName
    };

    setLastBoxResult(result);

    try {
      trackGaEvent('APP/Tienda/Caja/Abrir', {
        box_id: boxId,
        rarity: config.rarity,
        xp_cost: config.xpCost,
        stars_cost: config.starsCost,
        xp_reward: xpReward,
        stars_reward: starsReward,
        skin_key: rewardedSkinKey || 'none'
      });
    } catch (e) {
      console.error('Error tracking loot box event:', e);
    }
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
    
    // Compact styles for playing state - mostrar datos de la jugada actual
    if (gameState === 'playing') {
      const compactPadding = isMobile ? '4px 8px' : '6px 12px';
      const compactFontSize = isMobile ? '11px' : '13px';
      const sessionXP = game.sessionXP || 0;
      const healthColor = (game.currentHealth / game.maxHealth) > 0.5 ? '#00ff88' : 
                          (game.currentHealth / game.maxHealth) > 0.25 ? '#ffaa00' : '#ff3333';
      const iconSize = 16;
      const iconTextSize = '11px';
      
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
            gap: isMobile ? '10px' : '18px', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: compactFontSize, color: '#33ffff', fontWeight: 'bold' }}>
              Nivel {game.level}
            </span>
            <span style={{ fontSize: compactFontSize, color: '#FFD700' }}>
              ⭐ {game.currentStars} / {game.starsNeeded}
            </span>
            <span style={{ fontSize: compactFontSize, color: healthColor }}>
              ❤️ {game.currentHealth} / {game.maxHealth}
            </span>
            <span style={{ fontSize: compactFontSize, color: '#00aaff' }}>
              ⚡ +{sessionXP} XP
            </span>
          </div>
          
          {/* Íconos de specs durante partida - solo en landscape si es mobile */}
          {(!isMobile || isLandscape) && (
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center'
          }}>
              {/* Cajas - arriba de Skins */}
              <div 
                onClick={() => setShowFloatingShop('boxes')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 200, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 200, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#00c8ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 200, 255, 0.3)';
                }}
                title="Abrir Cajas"
              >
                <span style={{ fontSize: iconTextSize, color: '#00c8ff' }}>📦</span>
              </div>
              {/* Skin actual - abre skins */}
              <div 
                onClick={() => setShowFloatingShop('skins')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                }}
                title="Abrir Skins"
              >
                <Palette size={iconSize} style={{ color: '#FFD700' }} />
              </div>
              
              {/* Escudo */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(100, 149, 237, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 149, 237, 0.1)';
                  e.currentTarget.style.borderColor = '#6495ed';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(100, 149, 237, 0.3)';
                }}
                title="Escudo - Abrir Tienda"
              >
                <Shield size={iconSize} style={{ color: '#6495ed' }} />
                <span style={{ fontSize: iconTextSize, color: '#6495ed' }}>{shieldLevel}</span>
              </div>
              
              {/* Cabeza */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 0, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#ff00ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 255, 0.3)';
                }}
                title="Cabeza - Abrir Tienda"
              >
                <Zap size={iconSize} style={{ color: '#ff00ff' }} />
                <span style={{ fontSize: iconTextSize, color: '#ff00ff' }}>{headLevel}</span>
              </div>
              
              {/* Cañón */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 255, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#ffff00';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 0, 0.3)';
                }}
                title="Cañón - Abrir Tienda"
              >
                <Sparkles size={iconSize} style={{ color: '#ffff00' }} />
                <span style={{ fontSize: iconTextSize, color: '#ffff00' }}>{cannonLevel}</span>
              </div>
              
              {/* Imán */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 255, 136, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
                  e.currentTarget.style.borderColor = '#00ff88';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.3)';
                }}
                title="Imán - Abrir Tienda"
              >
                <Magnet size={iconSize} style={{ color: '#00ff88' }} />
                <span style={{ fontSize: iconTextSize, color: '#00ff88' }}>{magnetLevel}</span>
              </div>
              
              {/* Velocidad */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 170, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 170, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#00aaff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 170, 255, 0.3)';
                }}
                title="Velocidad - Abrir Tienda"
              >
                <Gauge size={iconSize} style={{ color: '#00aaff' }} />
                <span style={{ fontSize: iconTextSize, color: '#00aaff' }}>{speedLevel}</span>
              </div>
              
              {/* Vida */}
              <div 
                onClick={() => setShowFloatingShop('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '3px',
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 100, 100, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 100, 100, 0.1)';
                  e.currentTarget.style.borderColor = '#ff6464';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.3)';
                }}
                title="Vida - Abrir Tienda"
              >
                <Heart size={iconSize} style={{ color: '#ff6464' }} />
                <span style={{ fontSize: iconTextSize, color: '#ff6464' }}>{healthLevel}</span>
              </div>
          </div>
          )}
          
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: isMobile && !isLandscape ? '0' : '20px' }}>
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
            onClick={() => setGameState('menu')}
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
            Abandonar
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
      // Mobile layout: horizontal compacto para landscape, más espaciado para portrait
      return (
        <div style={{
          width: '100%',
          background: 'rgba(0, 0, 0, 0.95)',
          borderBottom: '2px solid #33ffff',
          padding: isLandscape ? '4px 10px' : headerPadding,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 20px rgba(51, 255, 255, 0.3)',
          zIndex: 1000
        }}>
          {/* Info del usuario - lado izquierdo */}
          <div style={{ 
            display: 'flex', 
            gap: isLandscape ? '12px' : gap, 
            alignItems: 'center', 
            flexWrap: 'nowrap',
            overflow: 'hidden'
          }}>
            <div>
              <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('game.username')}</div>
              <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {user?.username || t('game.username')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('game.xp_total')}</div>
              <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {totalXP}
              </div>
            </div>
            <div>
              <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('game.stars_total')}</div>
              <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#FFD700' }}>
                {totalStars}
              </div>
            </div>
            <div>
              <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('game.level')}</div>
              <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
                {level}
              </div>
            </div>
            <div>
              <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('game.series')}</div>
              <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#ff00ff' }}>
                {currentSeries}
              </div>
            </div>
            {rebirthCount > 0 && (
              <div>
                <div style={{ fontSize: isLandscape ? '7px' : labelFontSize, color: '#888' }}>{t('leaderboard.rebirth')}</div>
                <div style={{ fontSize: isLandscape ? '10px' : valueFontSize, fontWeight: 'bold', color: '#ff3366', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <img src="/assets/rebirth.webp" alt="Rebirth" style={{ width: isLandscape ? '12px' : '16px', height: isLandscape ? '12px' : '16px' }} /> {rebirthCount}
                </div>
              </div>
            )}
          </div>
          
          {/* Botones - lado derecho */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(true)}
                style={{
                  background: 'transparent',
                  border: '1px solid #33ffff',
                  color: '#33ffff',
                  padding: isLandscape ? '3px 6px' : '4px 8px',
                  fontSize: isLandscape ? '9px' : '10px',
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
            {gameState !== 'playing' && (
              <button
                onClick={startGame}
                style={{
                  background: 'transparent',
                  border: '1px solid #33ffff',
                  color: '#33ffff',
                  padding: isLandscape ? '3px 6px' : '4px 8px',
                  fontSize: isLandscape ? '9px' : '10px',
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
                {t('game.play')}
              </button>
            )}
            <button
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: '1px solid #ff3366',
                color: '#ff3366',
                padding: isLandscape ? '3px 6px' : '4px 8px',
                fontSize: isLandscape ? '9px' : '10px',
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
              {t('game.logout')}
            </button>
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
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('game.username')}</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {user?.username || t('game.username')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('game.xp_total')}</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {totalXP}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('game.stars_total')}</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#FFD700' }}>
              {totalStars}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('game.level_global')}</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#33ffff' }}>
              {level}
            </div>
          </div>
          <div>
            <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('game.series')}</div>
            <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff00ff' }}>
              {currentSeries}
            </div>
          </div>
          {rebirthCount > 0 && (
            <div>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '2px' }}>{t('leaderboard.rebirth')}</div>
              <div style={{ fontSize: valueFontSize, fontWeight: 'bold', color: '#ff3366', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <img src="/assets/rebirth.webp" alt="Rebirth" style={{ width: '16px', height: '16px' }} /> {rebirthCount}
              </div>
            </div>
          )}
          {gameState === 'playing' && (
            <div style={{ flex: 1, maxWidth: '300px', marginLeft: '20px' }}>
              <div style={{ fontSize: labelFontSize, color: '#888', marginBottom: '4px' }}>
                {t('game.level_progress')}: ⭐ {game.currentStars} / {game.starsNeeded}
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
                {t('game.health')}: ❤️ {game.currentHealth} / {game.maxHealth}
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
          {/* Right side: Specs and Skin - Solo en PC */}
          {!isMobile && (
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              {/* Cajas - arriba de Skin */}
              <div 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('boxes');
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 200, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 200, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#00c8ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 200, 255, 0.3)';
                }}
              >
                <span style={{ fontSize: iconTextSize, color: '#00c8ff' }}>📦 Cajas</span>
              </div>
              {/* Skin seleccionada */}
              <div 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('skins');
                  setShowSkinSelector(true);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 215, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                }}
              >
                <Palette size={iconSize} style={{ color: '#FFD700' }} />
                <span style={{ fontSize: iconTextSize, color: '#FFD700' }}>
                  {(SKINS[selectedSkin] && SKINS[selectedSkin].name) || 'Rainbow'}
                </span>
              </div>
              
              {/* Todos los specs - siempre visibles */}
              <div 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('shop');
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(100, 149, 237, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(100, 149, 237, 0.1)';
                  e.currentTarget.style.borderColor = '#6495ed';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(100, 149, 237, 0.3)';
                }}
              >
                <Shield size={iconSize} style={{ color: '#6495ed' }} />
                <span style={{ fontSize: iconTextSize, color: '#6495ed' }}>{shieldLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 0, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#ff00ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 255, 0.3)';
                }}
              >
                <Zap size={iconSize} style={{ color: '#ff00ff' }} />
                <span style={{ fontSize: iconTextSize, color: '#ff00ff' }}>{headLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 255, 0, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 0, 0.1)';
                  e.currentTarget.style.borderColor = '#ffff00';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 0, 0.3)';
                }}
              >
                <Sparkles size={iconSize} style={{ color: '#ffff00' }} />
                <span style={{ fontSize: iconTextSize, color: '#ffff00' }}>{cannonLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 255, 136, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)';
                  e.currentTarget.style.borderColor = '#00ff88';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.3)';
                }}
              >
                <Magnet size={iconSize} style={{ color: '#00ff88' }} />
                <span style={{ fontSize: iconTextSize, color: '#00ff88' }}>{magnetLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(0, 170, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 170, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#00aaff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 170, 255, 0.3)';
                }}
              >
                <Gauge size={iconSize} style={{ color: '#00aaff' }} />
                <span style={{ fontSize: iconTextSize, color: '#00aaff' }}>{speedLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 100, 100, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 100, 100, 0.1)';
                  e.currentTarget.style.borderColor = '#ff6464';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.3)';
                }}
              >
                <Rocket size={iconSize} style={{ color: '#ff6464' }} />
                <span style={{ fontSize: iconTextSize, color: '#ff6464' }}>{bulletSpeedLevel}</span>
              </div>
              
              <div 
                onClick={() => setGameState('shop')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'all 0.3s',
                  border: '1px solid rgba(255, 80, 80, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 80, 80, 0.1)';
                  e.currentTarget.style.borderColor = '#ff5050';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 80, 80, 0.3)';
                }}
              >
                <Heart size={iconSize} style={{ color: '#ff5050' }} />
                <span style={{ fontSize: iconTextSize, color: '#ff5050' }}>{healthLevel}</span>
              </div>
            </div>
          )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '20px' }}>
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
          {gameState !== 'playing' && (
            <button
              onClick={startGame}
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
              {t('game.play')}
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
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 51, 102, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
          }}
        >
                {t('game.logout')}
        </button>
        </div>
      </div>
    );
  };

  // Show banned message if user is banned
  // Verificar explícitamente si está baneado (no solo truthy)
  const userIsBanned = isBanned === true || isBanned === 'true' || isBanned === 1;
  
  if (userIsBanned) {
    console.log('User is banned, showing banned screen');
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#ff3366',
        fontSize: '24px',
        fontFamily: 'monospace',
        flexDirection: 'column',
        gap: '20px',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}>
        <h1 style={{ color: '#ff3366', margin: 0 }}>Cuenta Suspendida</h1>
        {bannedUntil && timeLeft ? (
          <p style={{ color: '#888', fontSize: '18px' }}>
            Tu cuenta está suspendida por {timeLeft.minutes} minutos y {timeLeft.seconds} segundos más
          </p>
        ) : bannedUntil ? (
          <p style={{ color: '#888', fontSize: '18px' }}>
            Tu cuenta está suspendida temporalmente
          </p>
        ) : (
          <p style={{ color: '#888', fontSize: '16px' }}>
            Tu cuenta ha sido suspendida permanentemente. Por favor contacta al administrador.
          </p>
        )}
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

  // Debug: verificar que el componente está renderizando
  console.log('SnakeGame render - isBanned:', isBanned, 'bannedUntil:', bannedUntil, 'loading:', loading, 'user:', user?.id);

  // Si está cargando, mostrar pantalla de carga
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
        Cargando...
      </div>
    );
  }

  // En móvil al jugar: usar position fixed para cubrir toda la pantalla (funciona en Safari iOS)
  const isMobilePlaying = gameState === 'playing' && isMobile;
  const playingHeight = isMobilePlaying
    ? (mobileViewportHeight ? `${mobileViewportHeight}px` : '100dvh')
    : (gameState === 'playing' ? '100vh' : 'auto');

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      ...(isMobilePlaying ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: mobileViewportHeight ? `${mobileViewportHeight}px` : '100%',
        zIndex: 9999,
      } : {
        height: playingHeight,
        minHeight: gameState === 'playing' ? '100vh' : '100vh',
      }),
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
      color: '#33ffff',
      fontFamily: 'monospace',
      overflow: gameState === 'playing' ? 'hidden' : 'auto'
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
      
      {/* Tienda/Skins flotante durante partida - solo desktop */}
      {showFloatingShop && gameState === 'playing' && !isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 2000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(10, 10, 30, 0.98)',
            border: '3px solid #33ffff',
            borderRadius: '15px',
            padding: '20px',
            maxWidth: '900px',
            maxHeight: '80vh',
            width: '100%',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 0 50px rgba(51, 255, 255, 0.5)'
          }}>
            {/* Botón cerrar */}
            <button
              onClick={() => setShowFloatingShop(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'transparent',
                border: '2px solid #ff3366',
                color: '#ff3366',
                padding: '5px 15px',
                fontSize: '14px',
                cursor: 'pointer',
                borderRadius: '5px',
                zIndex: 10
              }}
            >
              ✕ Cerrar
            </button>
            
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button
                onClick={() => setShowFloatingShop('shop')}
                style={{
                  background: showFloatingShop === 'shop' ? 'rgba(255, 0, 255, 0.2)' : 'transparent',
                  border: '2px solid #ff00ff',
                  color: '#ff00ff',
                  padding: '8px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: showFloatingShop === 'shop' ? 'bold' : 'normal'
                }}
              >
                {t('game.shop_cart')}
              </button>
              <button
                onClick={() => setShowFloatingShop('boxes')}
                style={{
                  background: showFloatingShop === 'boxes' ? 'rgba(0, 200, 255, 0.2)' : 'transparent',
                  border: '2px solid #00c8ff',
                  color: '#00c8ff',
                  padding: '8px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: showFloatingShop === 'boxes' ? 'bold' : 'normal'
                }}
              >
                📦 Cajas
              </button>
              <button
                onClick={() => setShowFloatingShop('skins')}
                style={{
                  background: showFloatingShop === 'skins' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: '2px solid #FFD700',
                  color: '#FFD700',
                  padding: '8px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  fontWeight: showFloatingShop === 'skins' ? 'bold' : 'normal'
                }}
              >
                🎨 {t('game.skins')}
              </button>
            </div>
            
            {/* Recursos disponibles */}
            <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '15px' }}>
              XP: <span style={{ color: '#00ff88' }}>{totalXP}</span> | ⭐: <span style={{ color: '#FFD700' }}>{totalStars}</span>
            </p>
            
            {/* Contenido TIENDA */}
            {showFloatingShop === 'shop' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {/* Escudo */}
                {(() => {
                  const next = getNextUpgrade('shield');
                  const currentLevel = shieldLevel;
                  return (
                    <div style={{ border: '2px solid #6495ed', padding: '12px', borderRadius: '8px', background: currentLevel > 0 ? 'rgba(100, 149, 237, 0.1)' : 'transparent' }}>
                      <Shield size={28} style={{ color: '#6495ed', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#6495ed', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_shield')} {currentLevel > 0 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('shield', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #6495ed', color: '#6495ed', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
                
                {/* Imán */}
                {(() => {
                  const next = getNextUpgrade('magnet');
                  const currentLevel = magnetLevel;
                  return (
                    <div style={{ border: '2px solid #00ff88', padding: '12px', borderRadius: '8px', background: currentLevel > 0 ? 'rgba(0, 255, 136, 0.1)' : 'transparent' }}>
                      <Magnet size={28} style={{ color: '#00ff88', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#00ff88', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_magnet')} {currentLevel > 0 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('magnet', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #00ff88', color: '#00ff88', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
                
                {/* Cañón */}
                {(() => {
                  const next = getNextUpgrade('cannon');
                  const currentLevel = cannonLevel;
                  return (
                    <div style={{ border: '2px solid #ffff00', padding: '12px', borderRadius: '8px', background: currentLevel > 0 ? 'rgba(255, 255, 0, 0.1)' : 'transparent' }}>
                      <Sparkles size={28} style={{ color: '#ffff00', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#ffff00', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_cannon')} {currentLevel > 0 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('cannon', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #ffff00', color: '#ffff00', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
                
                {/* Velocidad */}
                {(() => {
                  const next = getNextUpgrade('speed');
                  const currentLevel = speedLevel;
                  return (
                    <div style={{ border: '2px solid #00aaff', padding: '12px', borderRadius: '8px', background: currentLevel > 0 ? 'rgba(0, 170, 255, 0.1)' : 'transparent' }}>
                      <Gauge size={28} style={{ color: '#00aaff', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#00aaff', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_speed')} {currentLevel > 0 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('speed', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #00aaff', color: '#00aaff', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
                
                {/* Vida */}
                {(() => {
                  const next = getNextUpgrade('health');
                  const currentLevel = healthLevel;
                  return (
                    <div style={{ border: '2px solid #ff6464', padding: '12px', borderRadius: '8px', background: currentLevel > 0 ? 'rgba(255, 100, 100, 0.1)' : 'transparent' }}>
                      <Heart size={28} style={{ color: '#ff6464', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#ff6464', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_health')} {currentLevel > 0 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('health', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #ff6464', color: '#ff6464', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
                
                {/* Cabeza */}
                {(() => {
                  const next = getNextUpgrade('head');
                  const currentLevel = headLevel;
                  return (
                    <div style={{ border: '2px solid #ff00ff', padding: '12px', borderRadius: '8px', background: currentLevel > 1 ? 'rgba(255, 0, 255, 0.1)' : 'transparent' }}>
                      <Zap size={28} style={{ color: '#ff00ff', display: 'block', margin: '0 auto' }} />
                      <h4 style={{ color: '#ff00ff', textAlign: 'center', fontSize: '13px', margin: '8px 0 4px' }}>{t('game.upgrade_head')} {currentLevel > 1 ? `Lv.${currentLevel}` : ''}</h4>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0', color: '#aaa' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                          <button onClick={() => buyUpgrade('head', next.level)} disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)} style={{ width: '100%', background: 'transparent', border: '1px solid #ff00ff', color: '#ff00ff', padding: '5px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1 }}>{t('game.buy')}</button>
                        </>
                      ) : <p style={{ textAlign: 'center', fontSize: '11px', color: '#00ff88' }}>{t('game.max')}</p>}
                    </div>
                  );
                })()}
              </div>
            )}
            
            {/* Contenido CAJAS */}
            {showFloatingShop === 'boxes' && (
              <div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  {LOOT_BOXES.map(box => {
                    const canAfford = totalXP >= box.xpCost && totalStars >= box.starsCost;
                    return (
                      <div
                        key={box.id}
                        style={{
                          border: `2px solid ${box.borderColor}`,
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          boxShadow: `0 0 12px rgba(0, 0, 0, 0.6)`
                        }}
                      >
                        <h4 style={{ 
                          color: box.color, 
                          textAlign: 'center', 
                          fontSize: '13px', 
                          margin: '0 0 6px' 
                        }}>
                          {box.name}
                        </h4>
                        <p style={{ 
                          textAlign: 'center', 
                          fontSize: '10px', 
                          margin: '2px 0', 
                          color: '#aaa' 
                        }}>
                          XP: {box.xpRange[0]} - {box.xpRange[1]}
                        </p>
                        <p style={{ 
                          textAlign: 'center', 
                          fontSize: '10px', 
                          margin: '2px 0', 
                          color: '#aaa' 
                        }}>
                          ⭐: {box.starsRange[0]} - {box.starsRange[1]}
                        </p>
                        <p style={{ 
                          textAlign: 'center', 
                          fontSize: '10px', 
                          margin: '2px 0 6px', 
                          color: '#aaa' 
                        }}>
                          Skins: {Math.round(box.skinChance * 100)}% prob.
                        </p>
                        <p style={{ 
                          textAlign: 'center', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          margin: '4px 0',
                          color: '#fff'
                        }}>
                          Costo: {box.xpCost} XP{box.starsCost > 0 && ` + ${box.starsCost} ⭐`}
                        </p>
                        <button
                          onClick={() => openLootBox(box.id)}
                          disabled={!canAfford}
                          style={{
                            width: '100%',
                            background: canAfford ? box.color : 'transparent',
                            border: `1px solid ${box.borderColor}`,
                            color: canAfford ? '#000' : box.color,
                            padding: '6px',
                            fontSize: '11px',
                            cursor: canAfford ? 'pointer' : 'default',
                            borderRadius: '4px',
                            opacity: canAfford ? 1 : 0.5,
                            fontWeight: 'bold'
                          }}
                        >
                          Abrir caja
                        </button>
                      </div>
                    );
                  })}
                </div>

                {lastBoxResult && (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.4)',
                    fontSize: '12px',
                    color: '#fff'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      Última caja: <strong>{lastBoxResult.boxName}</strong>
                    </div>
                    <div style={{ marginBottom: '2px' }}>
                      Ganaste <strong style={{ color: '#00ff88' }}>{lastBoxResult.xpReward} XP</strong> y{' '}
                      <strong style={{ color: '#FFD700' }}>{lastBoxResult.starsReward} ⭐</strong>
                    </div>
                    {lastBoxResult.skinKey && (
                      <div style={{ marginTop: '2px', color: '#FFD700' }}>
                        🎁 Nueva skin: <strong>{lastBoxResult.skinName}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Contenido SKINS */}
            {showFloatingShop === 'skins' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                {Object.entries(SKINS)
                  .sort(([, a], [, b]) => {
                    const orderA = CATEGORY_REBIRTH_REQUIREMENTS[a.category] || 0;
                    const orderB = CATEGORY_REBIRTH_REQUIREMENTS[b.category] || 0;
                    return orderA - orderB;
                  })
                  .map(([key, skin]) => {
                    const isUnlocked = unlockedSkins.includes(key);
                    const isSelected = selectedSkin === key;
                    const xpNeeded = skin.xpPrice || 0;
                    const starsNeeded = skin.starsPrice || 0;
                    const canAffordXP = totalXP >= xpNeeded;
                    const canAffordStars = totalStars >= starsNeeded;
                    const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
                    const isCategoryUnlocked = rebirthCount >= requiredRebirth;
                    const canBuy = canAffordXP && canAffordStars && isCategoryUnlocked;
                    
                    const getCategoryColor = () => {
                      if (skin.category === 'farming_aura') return '#FFD700';
                      if (skin.category === 'legendary') return '#ff4444';
                      if (skin.category === 'mythic') return '#ff00ff';
                      if (skin.category === 'epic') return '#aa44ff';
                      if (skin.category === 'rare') return '#00aaff';
                      return '#00ff88';
                    };
                    
                    return (
                      <div key={key} style={{
                        border: isSelected ? '2px solid #FFD700' : `1px solid ${getCategoryColor()}`,
                        borderRadius: '8px',
                        padding: '10px',
                        background: isSelected ? 'rgba(255, 215, 0, 0.1)' : isUnlocked ? 'rgba(0, 255, 136, 0.05)' : 'rgba(0, 0, 0, 0.3)',
                        opacity: isUnlocked || canBuy ? 1 : 0.5
                      }}>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginBottom: '6px' }}>
                          {skin.colors.slice(0, 5).map((color, idx) => (
                            <div key={idx} style={{ width: '14px', height: '14px', background: `rgb(${color.r}, ${color.g}, ${color.b})`, borderRadius: '50%' }} />
                          ))}
                        </div>
                        <h4 style={{ color: isSelected ? '#FFD700' : '#fff', fontSize: '11px', textAlign: 'center', margin: '4px 0' }}>{skin.name}</h4>
                        {!isCategoryUnlocked && !isUnlocked && (
                          <p style={{ fontSize: '9px', color: '#ff6666', textAlign: 'center', margin: '2px 0' }}>🔒 {requiredRebirth} rebirth{requiredRebirth > 1 ? 's' : ''}</p>
                        )}
                        {isUnlocked ? (
                          <button onClick={() => selectSkin(key)} disabled={isSelected} style={{ width: '100%', background: 'transparent', border: `1px solid ${isSelected ? '#FFD700' : '#00ff88'}`, color: isSelected ? '#FFD700' : '#00ff88', padding: '4px', fontSize: '10px', cursor: isSelected ? 'default' : 'pointer', borderRadius: '4px' }}>
                            {isSelected ? '✓ ACTUAL' : 'USAR'}
                          </button>
                        ) : (
                          <>
                            <p style={{ fontSize: '9px', textAlign: 'center', margin: '2px 0', color: '#aaa' }}>
                              {xpNeeded > 0 && <span style={{ color: canAffordXP ? '#00ff88' : '#ff4444' }}>{xpNeeded} XP</span>}
                              {starsNeeded > 0 && <span style={{ color: canAffordStars ? '#FFD700' : '#ff4444' }}> ⭐{starsNeeded}</span>}
                            </p>
                            <button onClick={() => buySkin(key)} disabled={!canBuy} style={{ width: '100%', background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', padding: '4px', fontSize: '10px', cursor: canBuy ? 'pointer' : 'not-allowed', borderRadius: '4px', opacity: canBuy ? 1 : 0.5 }}>{t('game.buy')}</button>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Header siempre visible */}
      <UserHeader />
      
      {/* Content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile && gameState === 'menu' ? 'flex-start' : 'center',
        padding: gameState === 'playing' ? '0' : (isMobile ? '10px' : '20px'),
        paddingBottom: gameState === 'playing' ? '0' : (isMobile ? '20px' : '40px'),
        overflow: gameState === 'playing' ? 'hidden' : 'visible',
        position: 'relative',
        width: '100%',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch'
      }}>

      {(gameState === 'menu' || gameState === 'levelComplete') && (
        <div style={{ 
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: (isMobile && isLandscape) ? '10px' : '20px',
          width: '100%',
          maxWidth: '1200px',
          padding: (isMobile && isLandscape) ? '10px' : '20px',
          alignItems: isMobile ? 'center' : 'stretch',
          justifyContent: 'center',
          height: isMobile ? 'auto' : '100%'
        }}>
          {/* Left side: Logo/Info */}
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: (isMobile && isLandscape) ? '15px' : '30px',
          borderRadius: '10px',
          border: gameState === 'levelComplete' ? '2px solid #00ff88' : '2px solid #33ffff',
          boxShadow: gameState === 'levelComplete' ? '0 0 30px rgba(0, 255, 136, 0.3)' : '0 0 30px rgba(51, 255, 255, 0.3)',
          width: (isMobile && !isLandscape) ? '100%' : 'auto',
          minWidth: isMobile ? 'auto' : '400px',
          flex: (isMobile && isLandscape) ? '1' : (isMobile ? 'none' : '0 0 400px'),
          display: 'flex',
          flexDirection: (isMobile && isLandscape) ? 'row' : 'column',
          justifyContent: (isMobile && isLandscape) ? 'space-between' : 'space-between',
          alignItems: (isMobile && isLandscape) ? 'center' : 'stretch',
          gap: (isMobile && isLandscape) ? '20px' : '0',
          alignSelf: 'stretch'
        }}>
          {/* Logo y texto */}
          <div style={{ flex: (isMobile && isLandscape) ? '1' : '0 0 auto' }}>
            {gameState === 'levelComplete' ? (
              <>
                <Sparkles size={(isMobile && isLandscape) ? 40 : 64} style={{ color: '#00ff88', display: 'block', margin: '0 auto 10px' }} />
                <h2 style={{ color: '#00ff88', textShadow: '0 0 20px #00ff88', marginBottom: '10px', fontSize: (isMobile && isLandscape) ? '20px' : '32px' }}>
                  ¡NIVEL COMPLETADO!
                </h2>
                <p style={{ fontSize: (isMobile && isLandscape) ? '16px' : '24px', marginBottom: '10px', color: '#33ffff' }}>
                  ⭐ Estrellas: {gameRef.current.currentStars}
                </p>
                <p style={{ fontSize: (isMobile && isLandscape) ? '14px' : '20px', marginBottom: '0', color: '#33ffff' }}>
                  XP Ganado: {gameRef.current.sessionXP}
                </p>
              </>
            ) : (
              <>
                <img 
                  src="/logo.png" 
                  alt="Neon Snake" 
                  style={{ 
                    width: '100%', 
                    maxWidth: (isMobile && isLandscape) ? '200px' : '400px', 
                    height: 'auto',
                    marginBottom: (isMobile && isLandscape) ? '10px' : '20px',
                    filter: 'drop-shadow(0 0 20px rgba(0, 255, 0, 0.5))'
                  }} 
                />
                {!(isMobile && isLandscape) && (
                  <p style={{ fontSize: '16px', marginBottom: '0', lineHeight: '1.6', color: '#aaa' }}>
                    {t('game.instruction_move')}<br/>
                    {t('game.instruction_eat')}<br/>
                    {t('game.instruction_stars')}
                  </p>
                )}
              </>
            )}
          </div>
          
          {/* Botones - al lado en landscape, abajo en portrait */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: (isMobile && isLandscape) ? '8px' : '15px',
            width: (isMobile && isLandscape) ? 'auto' : '100%',
            minWidth: (isMobile && isLandscape) ? '140px' : 'auto',
            marginTop: (isMobile && isLandscape) ? '0' : 'auto',
            flex: '0 0 auto',
            justifyContent: 'center'
          }}>
            {/* TIENDA y SKINS */}
            <div style={{ 
              display: 'flex', 
              gap: (isMobile && isLandscape) ? '8px' : '15px', 
              flexDirection: (isMobile && isLandscape) ? 'column' : (isMobile ? 'column' : 'row')
            }}>
              <button 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('shop');
                }}
                style={{
                  background: 'transparent',
                  border: '2px solid #ff00ff',
                  color: '#ff00ff',
                  padding: (isMobile && isLandscape) ? '6px 12px' : '10px 20px',
                  fontSize: (isMobile && isLandscape) ? '12px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  textShadow: '0 0 10px #ff00ff',
                  boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
                  flex: (isMobile && isLandscape) ? 'none' : (isMobile ? 'none' : 1),
                  minWidth: (isMobile && !isLandscape) ? '100%' : 'auto',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 0, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                {t('game.shop')}
              </button>
              <button 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('boxes');
                }}
                style={{
                  background: 'transparent',
                  border: '2px solid #00c8ff',
                  color: '#00c8ff',
                  padding: (isMobile && isLandscape) ? '6px 12px' : '10px 20px',
                  fontSize: (isMobile && isLandscape) ? '12px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  textShadow: '0 0 10px #00c8ff',
                  boxShadow: '0 0 20px rgba(0, 200, 255, 0.5)',
                  flex: (isMobile && isLandscape) ? 'none' : (isMobile ? 'none' : 1),
                  minWidth: (isMobile && !isLandscape) ? '100%' : 'auto',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(0, 200, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                📦 Cajas
              </button>
              <button 
                onClick={() => {
                  setGameState('shop');
                  setActiveShopTab('skins');
                  setShowSkinSelector(true);
                }}
                style={{
                  background: 'transparent',
                  border: '2px solid #FFD700',
                  color: '#FFD700',
                  padding: (isMobile && isLandscape) ? '6px 12px' : '10px 20px',
                  fontSize: (isMobile && isLandscape) ? '12px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  textShadow: '0 0 10px #FFD700',
                  boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                  flex: (isMobile && isLandscape) ? 'none' : (isMobile ? 'none' : 1),
                  minWidth: (isMobile && !isLandscape) ? '100%' : 'auto',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              >
                {t('game.skins')}
              </button>
            </div>
            
            {/* Botón JUGAR o SIGUIENTE NIVEL */}
            <button 
              onClick={gameState === 'levelComplete' ? nextLevel : startGame}
              style={{
                background: 'transparent',
                border: gameState === 'levelComplete' ? '2px solid #00ff88' : '2px solid #33ffff',
                color: gameState === 'levelComplete' ? '#00ff88' : '#33ffff',
                padding: (isMobile && isLandscape) ? '8px 16px' : '20px 40px',
                fontSize: (isMobile && isLandscape) ? '14px' : '24px',
                cursor: 'pointer',
                borderRadius: '5px',
                textShadow: gameState === 'levelComplete' ? '0 0 10px #00ff88' : '0 0 10px #33ffff',
                boxShadow: gameState === 'levelComplete' ? '0 0 20px rgba(0, 255, 136, 0.5)' : '0 0 20px rgba(51, 255, 255, 0.5)',
                width: (isMobile && isLandscape) ? 'auto' : '100%',
                transition: 'all 0.3s',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = gameState === 'levelComplete' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(51, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
              }}
            >
              {gameState === 'levelComplete' ? t('game.next_level') : t('game.play')}
            </button>
          </div>
        </div>

          {/* Leaderboards - debajo en mobile landscape, al lado en desktop */}
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            width: isMobile ? '100%' : 'auto',
            flex: isMobile ? 'none' : '1'
          }}>
            {/* Primera fila: 3 rankings arriba */}
            <div style={{ 
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '20px',
              width: '100%'
            }}>
            {/* Ranking por XP */}
            <div style={{ 
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #FFD700',
              boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
              flex: '1',
              minWidth: isMobile ? 'auto' : '300px'
            }}>
              <h2 style={{ 
                color: '#FFD700', 
                textShadow: '0 0 20px #FFD700', 
                textAlign: 'center',
                marginBottom: '10px',
                fontSize: '14px'
              }}>
                🏆 RANKING XP
              </h2>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {leaderboard.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>Cargando...</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #FFD700' }}>
                        <th style={{ padding: '6px', textAlign: 'left', color: '#FFD700', fontSize: '11px' }}>#</th>
                        <th style={{ padding: '6px', textAlign: 'left', color: '#FFD700', fontSize: '11px' }}>Usuario</th>
                        <th style={{ padding: '6px', textAlign: 'right', color: '#FFD700', fontSize: '11px' }}>XP</th>
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
                          <td style={{ padding: '6px', color: index < 3 ? '#FFD700' : '#33ffff', fontSize: '12px' }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td style={{ padding: '6px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '12px' }}>
                            {entry.username}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right', color: '#33ffff', fontSize: '12px' }}>
                            {entry.totalXp?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Ranking combinado: Rebirth, Nivel y Niveles Totales */}
            {(() => {
              // Combinar datos de ambos leaderboards
              const combinedData = [];
              const userMap = new Map();
              
              // Agregar datos de rebirth
              leaderboardByRebirth.forEach(entry => {
                userMap.set(entry.username, {
                  username: entry.username,
                  rebirthCount: entry.rebirthCount || 0,
                  highestLevel: 0,
                  totalSessions: entry.totalSessions || 0
                });
              });
              
              // Agregar/actualizar datos de nivel
              leaderboardByLevel.forEach(entry => {
                if (userMap.has(entry.username)) {
                  userMap.get(entry.username).highestLevel = entry.highestLevel || 1;
                  userMap.get(entry.username).totalSessions = entry.totalSessions || userMap.get(entry.username).totalSessions || 0;
                } else {
                  userMap.set(entry.username, {
                    username: entry.username,
                    rebirthCount: 0,
                    highestLevel: entry.highestLevel || 1,
                    totalSessions: entry.totalSessions || 0
                  });
                }
              });
              
              // Convertir a array y ordenar: primero por rebirth (desc), luego por nivel (desc)
              combinedData.push(...Array.from(userMap.values()));
              combinedData.sort((a, b) => {
                if (b.rebirthCount !== a.rebirthCount) {
                  return b.rebirthCount - a.rebirthCount;
                }
                return (b.highestLevel || 1) - (a.highestLevel || 1);
              });
              
              return (
                <div style={{ 
                  background: 'rgba(0, 0, 0, 0.7)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #33ffff',
                  boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
                  flex: '2', // Ocupa dos casilleros
                  minWidth: isMobile ? 'auto' : '600px'
                }}>
                  <h2 style={{ 
                    color: '#33ffff', 
                    textShadow: '0 0 20px #33ffff', 
                    textAlign: 'center',
                    marginBottom: '10px',
                    fontSize: '14px'
                  }}>
                    🔄⭐ RANKING REBIRTH & NIVEL
                  </h2>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {combinedData.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>Cargando...</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #33ffff' }}>
                            <th style={{ padding: '6px', textAlign: 'left', color: '#33ffff', fontSize: '11px' }}>#</th>
                            <th style={{ padding: '6px', textAlign: 'left', color: '#33ffff', fontSize: '11px' }}>Usuario</th>
                            <th style={{ padding: '6px', textAlign: 'right', color: '#ff3366', fontSize: '11px' }}>Rebirth</th>
                            <th style={{ padding: '6px', textAlign: 'right', color: '#33ffff', fontSize: '11px' }}>Nivel</th>
                            <th style={{ padding: '6px', textAlign: 'right', color: '#FFD700', fontSize: '11px' }}>Niveles Totales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedData.map((entry, index) => (
                            <tr 
                              key={entry.username}
                              style={{ 
                                borderBottom: '1px solid rgba(51, 255, 255, 0.2)',
                                backgroundColor: entry.username === user?.username ? 'rgba(51, 255, 255, 0.1)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '6px', color: index < 3 ? '#33ffff' : '#FFD700', fontSize: '12px' }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                              </td>
                              <td style={{ padding: '6px', color: entry.username === user?.username ? '#33ffff' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '12px' }}>
                                {entry.username}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', color: '#ff3366', fontSize: '12px' }}>
                                {entry.rebirthCount || 0}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', color: '#33ffff', fontSize: '12px' }}>
                                {entry.highestLevel || 1}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>
                                {entry.totalSessions || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>

            {/* Segunda fila: 3 rankings abajo */}
            <div style={{ 
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '20px',
              width: '100%'
            }}>
              {/* Ranking por XP Total */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #00ff88',
                boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
                flex: '1',
                minWidth: isMobile ? 'auto' : '300px'
              }}>
                <h2 style={{ 
                  color: '#00ff88', 
                  textShadow: '0 0 20px #00ff88', 
                  textAlign: 'center',
                  marginBottom: '10px',
                  fontSize: '14px'
                }}>
                  💎 XP TOTAL
                </h2>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {leaderboardByTotalXP.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #00ff88' }}>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#00ff88', fontSize: '11px' }}>#</th>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#00ff88', fontSize: '11px' }}>Usuario</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: '#00ff88', fontSize: '11px' }}>XP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardByTotalXP.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(0, 255, 136, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '6px', color: index < 3 ? '#00ff88' : '#33ffff', fontSize: '12px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '6px', color: entry.username === user?.username ? '#00ff88' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '12px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#33ffff', fontSize: '12px' }}>
                              {entry.totalXp?.toLocaleString() || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Ranking por Estrellas Totales */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #FFD700',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
                flex: '1',
                minWidth: isMobile ? 'auto' : '300px'
              }}>
                <h2 style={{ 
                  color: '#FFD700', 
                  textShadow: '0 0 20px #FFD700', 
                  textAlign: 'center',
                  marginBottom: '10px',
                  fontSize: '14px'
                }}>
                  ⭐ ESTRELLAS TOTALES
                </h2>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {leaderboardByTotalStars.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #FFD700' }}>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#FFD700', fontSize: '11px' }}>#</th>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#FFD700', fontSize: '11px' }}>Usuario</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: '#FFD700', fontSize: '11px' }}>Estrellas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardByTotalStars.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '6px', color: index < 3 ? '#FFD700' : '#ffff00', fontSize: '12px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '6px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '12px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#ffff00', fontSize: '12px' }}>
                              {entry.totalStars?.toLocaleString() || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Ranking por Serie */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '8px',
                border: '2px solid #ff00ff',
                boxShadow: '0 0 30px rgba(255, 0, 255, 0.3)',
                flex: '1',
                minWidth: isMobile ? 'auto' : '300px'
              }}>
                <h2 style={{ 
                  color: '#ff00ff', 
                  textShadow: '0 0 20px #ff00ff', 
                  textAlign: 'center',
                  marginBottom: '10px',
                  fontSize: '14px'
                }}>
                  🔢 SERIE
                </h2>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {leaderboardBySeries.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #ff00ff' }}>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#ff00ff', fontSize: '11px' }}>#</th>
                          <th style={{ padding: '6px', textAlign: 'left', color: '#ff00ff', fontSize: '11px' }}>Usuario</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: '#ff00ff', fontSize: '11px' }}>Serie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardBySeries.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(255, 0, 255, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(255, 0, 255, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '6px', color: index < 3 ? '#ff00ff' : '#ff88ff', fontSize: '12px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '6px', color: entry.username === user?.username ? '#ff00ff' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '12px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '6px', textAlign: 'right', color: '#ff88ff', fontSize: '12px' }}>
                              {entry.currentSeries || 1}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div style={{ 
              marginTop: '15px',
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #33ffff',
              boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
              width: '100%'
            }}>
              <h2 style={{ 
                color: '#33ffff', 
                textShadow: '0 0 20px #33ffff', 
                textAlign: 'center',
                marginBottom: '10px',
                fontSize: '14px'
              }}>
                💬 CHAT
              </h2>
              
              {/* Messages container */}
              <div 
                id="chat-messages"
                style={{ 
                  maxHeight: '150px',
                  overflowY: 'auto',
                  marginBottom: '10px',
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '5px',
                  border: '1px solid rgba(51, 255, 255, 0.2)'
                }}
              >
                {chatMessages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>No hay mensajes aún. ¡Sé el primero en escribir!</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      style={{ 
                        marginBottom: '10px',
                        padding: '8px',
                        background: msg.userId === user?.id ? 'rgba(51, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '5px',
                        borderLeft: `3px solid ${msg.userId === user?.id ? '#33ffff' : '#888'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ 
                          color: msg.userId === user?.id ? '#33ffff' : '#fff', 
                          fontWeight: 'bold',
                      fontSize: '11px'
                    }}>
                      {msg.username}
                    </span>
                    <span style={{ color: '#888', fontSize: '9px' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#fff', fontSize: '11px', wordBreak: 'break-word' }}>
                    {msg.message}
                  </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder={user ? "Escribe un mensaje..." : "Inicia sesión para chatear"}
                  disabled={!user}
                  maxLength={500}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: '2px solid #33ffff',
                    borderRadius: '5px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!user || !chatInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: user && chatInput.trim() ? 'transparent' : 'rgba(51, 255, 255, 0.2)',
                    border: '2px solid #33ffff',
                    borderRadius: '5px',
                    color: user && chatInput.trim() ? '#33ffff' : '#888',
                    fontSize: '12px',
                    cursor: user && chatInput.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (user && chatInput.trim()) {
                      e.target.style.background = 'rgba(51, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (user && chatInput.trim()) {
                      e.target.style.background = 'transparent';
                    }
                  }}
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'shop' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.95)',
          padding: (isMobile && isLandscape) ? '10px 15px' : '30px',
          borderRadius: (isMobile && isLandscape) ? '5px' : '10px',
          border: activeShopTab === 'shop' ? '3px solid #ff00ff' : activeShopTab === 'boxes' ? '3px solid #00c8ff' : '3px solid #FFD700',
          boxShadow: activeShopTab === 'shop' ? '0 0 40px rgba(255, 0, 255, 0.5)' : activeShopTab === 'boxes' ? '0 0 40px rgba(0, 200, 255, 0.5)' : '0 0 40px rgba(255, 215, 0, 0.5)',
          maxWidth: '1400px',
          width: (isMobile && isLandscape) ? 'calc(100% - 20px)' : '100%',
          margin: (isMobile && isLandscape) ? '5px auto' : '20px auto',
          maxHeight: (isMobile && isLandscape) ? 'none' : 'calc(100vh - 200px)',
          minHeight: (isMobile && isLandscape) ? 'calc(100vh - 60px)' : 'auto',
          overflowY: 'auto',
          position: 'relative'
        }}>
          {/* Header con pestañas y botón volver */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: (isMobile && isLandscape) ? '10px' : '20px',
            gap: (isMobile && isLandscape) ? '8px' : '15px'
          }}>
            {/* Pestañas a la izquierda */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setActiveShopTab('shop');
                  setShowSkinSelector(false);
                }}
                style={{
                  background: activeShopTab === 'shop' ? 'rgba(255, 0, 255, 0.2)' : 'transparent',
                  border: '2px solid #ff00ff',
                  color: '#ff00ff',
                  padding: (isMobile && isLandscape) ? '5px 12px' : '8px 20px',
                  fontSize: (isMobile && isLandscape) ? '11px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  transition: 'all 0.3s',
                  fontWeight: activeShopTab === 'shop' ? 'bold' : 'normal',
                  boxShadow: activeShopTab === 'shop' ? '0 0 15px rgba(255, 0, 255, 0.5)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeShopTab !== 'shop') {
                    e.target.style.background = 'rgba(255, 0, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeShopTab !== 'shop') {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                {t('game.shop')}
              </button>
              <button
                onClick={() => {
                  setActiveShopTab('boxes');
                  setShowSkinSelector(false);
                }}
                style={{
                  background: activeShopTab === 'boxes' ? 'rgba(0, 200, 255, 0.2)' : 'transparent',
                  border: '2px solid #00c8ff',
                  color: '#00c8ff',
                  padding: (isMobile && isLandscape) ? '5px 12px' : '8px 20px',
                  fontSize: (isMobile && isLandscape) ? '11px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  transition: 'all 0.3s',
                  fontWeight: activeShopTab === 'boxes' ? 'bold' : 'normal',
                  boxShadow: activeShopTab === 'boxes' ? '0 0 15px rgba(0, 200, 255, 0.5)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeShopTab !== 'boxes') {
                    e.target.style.background = 'rgba(0, 200, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeShopTab !== 'boxes') {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                📦 Cajas
              </button>
              <button
                onClick={() => {
                  setActiveShopTab('skins');
                  setShowSkinSelector(true);
                }}
                style={{
                  background: activeShopTab === 'skins' ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: '2px solid #FFD700',
                  color: '#FFD700',
                  padding: (isMobile && isLandscape) ? '5px 12px' : '8px 20px',
                  fontSize: (isMobile && isLandscape) ? '11px' : '14px',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  transition: 'all 0.3s',
                  fontWeight: activeShopTab === 'skins' ? 'bold' : 'normal',
                  boxShadow: activeShopTab === 'skins' ? '0 0 15px rgba(255, 215, 0, 0.5)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (activeShopTab !== 'skins') {
                    e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeShopTab !== 'skins') {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                🎨 SKINS
              </button>
            </div>
            
            {/* Botón VOLVER a la derecha */}
            <button
              onClick={() => {
                setGameState('menu');
                setShowSkinSelector(false);
                setActiveShopTab('shop');
              }}
              style={{
                background: 'transparent',
                border: '2px solid #33ffff',
                color: '#33ffff',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                borderRadius: '5px',
                transition: 'all 0.3s',
                flex: '0 0 auto'
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
          </div>
          
          {/* Contenido según la pestaña activa */}
          {activeShopTab === 'shop' && (
            <>
              <h2 style={{ color: '#ff00ff', textShadow: '0 0 20px #ff00ff', textAlign: 'center', fontSize: '24px', marginBottom: '15px' }}>
                {t('game.shop')}
              </h2>
              <p style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center' }}>
                {t('game.xp_total')}: {totalXP} | {t('game.stars_total')}: {totalStars}
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
                        {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                        {t('game.buy_level')} {next.level}
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
                        {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                        {t('game.buy_level')} {next.level}
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
                        {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                        {t('game.buy_level')} {next.level}
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
                        {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                        {t('game.buy_level')} {next.level}
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
                          {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                          {t('game.buy_level')} {next.level}
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
                          {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                          {t('game.buy_level')} {next.level}
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
            </>
          )}
          
          {/* Contenido de CAJAS */}
          {activeShopTab === 'boxes' && (
            <div>
              <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '15px' }}>
                XP: <span style={{ color: '#00ff88' }}>{totalXP}</span> | ⭐: <span style={{ color: '#FFD700' }}>{totalStars}</span>
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '12px',
                marginBottom: '20px'
              }}>
                {LOOT_BOXES.map(box => {
                  const canAfford = totalXP >= box.xpCost && totalStars >= box.starsCost;
                  return (
                    <div
                      key={box.id}
                      style={{
                        border: `2px solid ${box.borderColor}`,
                        padding: '12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        boxShadow: `0 0 12px rgba(0, 0, 0, 0.6)`
                      }}
                    >
                      <h4 style={{ color: box.color, textAlign: 'center', fontSize: '13px', margin: '0 0 6px' }}>{box.name}</h4>
                      <p style={{ textAlign: 'center', fontSize: '10px', margin: '2px 0', color: '#aaa' }}>XP: {box.xpRange[0]} - {box.xpRange[1]}</p>
                      <p style={{ textAlign: 'center', fontSize: '10px', margin: '2px 0', color: '#aaa' }}>⭐: {box.starsRange[0]} - {box.starsRange[1]}</p>
                      <p style={{ textAlign: 'center', fontSize: '10px', margin: '2px 0 6px', color: '#aaa' }}>Skins: {Math.round((box.skinChance || 0) * 100)}% prob.</p>
                      <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0', color: '#fff' }}>Costo: {box.xpCost} XP{box.starsCost > 0 && ` + ${box.starsCost} ⭐`}</p>
                      <button
                        onClick={() => openLootBox(box.id)}
                        disabled={!canAfford}
                        style={{
                          width: '100%',
                          background: canAfford ? box.color : 'transparent',
                          border: `1px solid ${box.borderColor}`,
                          color: canAfford ? '#000' : box.color,
                          padding: '6px',
                          fontSize: '11px',
                          cursor: canAfford ? 'pointer' : 'default',
                          borderRadius: '4px',
                          opacity: canAfford ? 1 : 0.5,
                          fontWeight: 'bold'
                        }}
                      >
                        Abrir caja
                      </button>
                    </div>
                  );
                })}
              </div>
              {lastBoxResult && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.4)', fontSize: '12px', color: '#fff' }}>
                  <div style={{ marginBottom: '4px' }}>Última caja: <strong>{lastBoxResult.boxName}</strong></div>
                  <div style={{ marginBottom: '2px' }}>Ganaste <strong style={{ color: '#00ff88' }}>{lastBoxResult.xpReward} XP</strong> y <strong style={{ color: '#FFD700' }}>{lastBoxResult.starsReward} ⭐</strong></div>
                  {lastBoxResult.skinKey && <div style={{ marginTop: '2px', color: '#FFD700' }}>🎁 Nueva skin: <strong>{lastBoxResult.skinName}</strong></div>}
                </div>
              )}
            </div>
          )}
          
          {/* Contenido de SKINS */}
          {activeShopTab === 'skins' && (
            <>
              <h2 style={{ 
                color: '#FFD700', 
                textShadow: '0 0 20px #FFD700', 
                textAlign: 'center', 
                fontSize: (isMobile && isLandscape) ? '16px' : '24px',
                marginBottom: (isMobile && isLandscape) ? '8px' : '15px'
              }}>
                {t('game.shop_skins_title')}
              </h2>
              <p style={{ 
                fontSize: (isMobile && isLandscape) ? '12px' : '16px', 
                marginBottom: (isMobile && isLandscape) ? '10px' : '20px', 
                textAlign: 'center',
                color: '#aaa'
              }}>
                XP Total: {totalXP} | ⭐ Total: {totalStars}
              </p>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: (isMobile && isLandscape) ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: (isMobile && isLandscape) ? '10px' : '20px',
              marginTop: (isMobile && isLandscape) ? '10px' : '20px'
            }}>
              {Object.entries(SKINS)
                .sort(([, a], [, b]) => {
                  // Ordenar por requisito de rebirth (menor a mayor)
                  const orderA = CATEGORY_REBIRTH_REQUIREMENTS[a.category] || 0;
                  const orderB = CATEGORY_REBIRTH_REQUIREMENTS[b.category] || 0;
                  return orderA - orderB;
                })
                .map(([key, skin]) => {
                const isUnlocked = unlockedSkins.includes(key);
                const isSelected = selectedSkin === key;
                const xpNeeded = skin.xpPrice || 0;
                const starsNeeded = skin.starsPrice || 0;
                const canAffordXP = totalXP >= xpNeeded;
                const canAffordStars = totalStars >= starsNeeded;
                const canAfford = canAffordXP && canAffordStars;
                
                // Determinar color de categoría (estilo Brawl Stars)
                const getCategoryColor = () => {
                  if (skin.category === 'farming_aura') return '#FFD700'; // Dorado brillante
                  if (skin.category === 'legendary') return '#ff4444';    // Rojo
                  if (skin.category === 'mythic') return '#ff00ff';       // Púrpura/Magenta
                  if (skin.category === 'epic') return '#aa44ff';         // Violeta
                  if (skin.category === 'rare') return '#00aaff';         // Azul
                  return '#00ff88';                                       // Verde (común)
                };
                
                // Obtener label de categoría
                const getCategoryLabel = () => {
                  if (skin.category === 'farming_aura') return '👑 FARMING AURA';
                  if (skin.category === 'legendary') return '🏆 LEGENDARIO';
                  if (skin.category === 'mythic') return '💎 MÍTICO';
                  if (skin.category === 'epic') return '⚡ ÉPICO';
                  if (skin.category === 'rare') return '💙 RARO';
                  return ''; // No mostrar badge para común
                };
                
                // Verificar si la categoría está desbloqueada por rebirth
                const requiredRebirth = CATEGORY_REBIRTH_REQUIREMENTS[skin.category] || 0;
                const isCategoryUnlocked = rebirthCount >= requiredRebirth;
                const canBuy = canAfford && isCategoryUnlocked;
                
                return (
                  <div
                    key={key}
                    style={{
                      border: isSelected ? '3px solid #FFD700' : isUnlocked ? '2px solid #00ff88' : `2px solid ${getCategoryColor()}`,
                      borderRadius: (isMobile && isLandscape) ? '6px' : '10px',
                      padding: (isMobile && isLandscape) ? '8px' : '15px',
                      background: isSelected 
                        ? 'rgba(255, 215, 0, 0.2)' 
                        : isUnlocked 
                          ? 'rgba(0, 255, 136, 0.1)' 
                          : 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: (isMobile && isLandscape) ? '5px' : '10px',
                      position: 'relative',
                      opacity: isUnlocked || canAfford ? 1 : 0.6
                    }}
                  >
                    {/* Badge de categoría */}
                    {!isUnlocked && skin.category !== 'common' && getCategoryLabel() && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: getCategoryColor(),
                        color: skin.category === 'legendary' ? '#fff' : '#000',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap'
                      }}>
                        {getCategoryLabel()}
                      </div>
                    )}
                    
                    {/* Preview de colores */}
                    <div style={{
                      display: 'flex',
                      gap: '2px',
                      marginBottom: '5px',
                      marginTop: skin.category !== 'common' && !isUnlocked && getCategoryLabel() ? '5px' : '0'
                    }}>
                      {skin.colors.slice(0, 7).map((color, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: '20px',
                            height: '20px',
                            background: `rgb(${color.r}, ${color.g}, ${color.b})`,
                            borderRadius: '50%',
                            border: '1px solid rgba(255, 255, 255, 0.3)'
                          }}
                        />
                      ))}
                    </div>
                    
                    <h3 style={{ 
                      color: isSelected ? '#FFD700' : isUnlocked ? '#00ff88' : '#fff',
                      fontSize: '16px',
                      textAlign: 'center',
                      margin: 0,
                      fontWeight: isSelected ? 'bold' : 'normal'
                    }}>
                      {skin.name}
                    </h3>
                    
                    <p style={{ 
                      color: '#aaa',
                      fontSize: '12px',
                      textAlign: 'center',
                      margin: 0,
                      minHeight: '32px'
                    }}>
                      {skin.description}
                    </p>
                    
                    {skin.special && (
                      <div style={{
                        fontSize: '11px',
                        color: '#ff00ff',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        {skin.special === 'web' && '🕷️ Telarañas'}
                        {skin.special === 'red_blaster' && '🔴 Rayo Rojo'}
                        {(skin.special === 'slingshot' || skin.special === 'rock') && '🪨 Rocas'}
                        {skin.special === 'book' && '📚 Libros'}
                        {skin.special === 'pacifier' && '🍼 Chupetes'}
                        {skin.special === 'pork_chop' && '🥩 Chuletas'}
                        {skin.special === 'white_spell' && '✨ Hechizos'}
                        {skin.special === 'blaster' && '🔫 Blaster'}
                        {skin.special === 'donut' && '🍩 Rosquillas'}
                        {skin.special === 'banana' && '🍌 Bananas'}
                        {skin.special === 'hammer' && '🔨 Mjolnir'}
                        {skin.special === 'shield' && '🛡️ Escudo'}
                        {skin.special === 'fist' && '👊 Puños'}
                        {skin.special === 'spell' && '⚡ Hechizos'}
                        {skin.special === 'sith_laser' && '🔴 Sable Láser'}
                        {skin.special === 'repulsor' && '💫 Repulsores'}
                        {skin.special === 'venom' && '🖤 Tentáculos'}
                      </div>
                    )}
                    
                    {isUnlocked ? (
                      <button
                        onClick={() => selectSkin(key)}
                        disabled={isSelected}
                        style={{
                          background: isSelected ? 'rgba(255, 215, 0, 0.3)' : 'transparent',
                          border: `2px solid ${isSelected ? '#FFD700' : '#00ff88'}`,
                          color: isSelected ? '#FFD700' : '#00ff88',
                          padding: '8px 16px',
                          fontSize: '14px',
                          cursor: isSelected ? 'default' : 'pointer',
                          borderRadius: '5px',
                          width: '100%',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.target.style.background = 'rgba(0, 255, 136, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.target.style.background = 'transparent';
                          }
                        }}
                      >
                        {isSelected ? '✓ SELECCIONADA' : 'SELECCIONAR'}
                      </button>
                    ) : (
                      <div style={{ width: '100%' }}>
                        {/* Mostrar requisito de rebirth si está bloqueada */}
                        {!isCategoryUnlocked && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            marginBottom: '8px',
                            fontSize: '11px',
                            color: '#ff6666',
                            background: 'rgba(255, 0, 0, 0.1)',
                            padding: '4px 8px',
                            borderRadius: '5px'
                          }}>
                            🔒 Requiere {requiredRebirth} rebirth{requiredRebirth > 1 ? 's' : ''}
                          </div>
                        )}
                        {/* Mostrar precio */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '10px',
                          marginBottom: '8px',
                          fontSize: '13px',
                          opacity: isCategoryUnlocked ? 1 : 0.5
                        }}>
                          {xpNeeded > 0 && (
                            <span style={{ color: canAffordXP && isCategoryUnlocked ? '#00ff88' : '#ff4444' }}>
                              {xpNeeded.toLocaleString()} XP
                            </span>
                          )}
                          {starsNeeded > 0 && (
                            <span style={{ color: canAffordStars && isCategoryUnlocked ? '#FFD700' : '#ff4444' }}>
                              ⭐ {starsNeeded}
                            </span>
                          )}
                          {xpNeeded === 0 && starsNeeded === 0 && (
                            <span style={{ color: '#00ff88' }}>{t('game.free')}</span>
                          )}
                        </div>
                        <button
                          onClick={() => buySkin(key)}
                          disabled={!canBuy}
                          style={{
                            background: 'transparent',
                            border: `2px solid ${canBuy ? '#FFD700' : '#666'}`,
                            color: canBuy ? '#FFD700' : '#666',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: canBuy ? 'pointer' : 'not-allowed',
                            borderRadius: '5px',
                            width: '100%',
                            opacity: canBuy ? 1 : 0.5,
                            transition: 'all 0.3s'
                          }}
                          onMouseEnter={(e) => {
                            if (canBuy) {
                              e.target.style.background = 'rgba(255, 215, 0, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (canBuy) {
                              e.target.style.background = 'transparent';
                            }
                          }}
                        >
                          {t('game.buy')}
                        </button>
                      </div>
                    )}
                    
                    {isUnlocked && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        fontSize: '20px'
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      )}

      {gameState === 'levelIntro' && (() => {
        const introMessage = getLevelIntroMessage(level, levelConfigs, t, lang);
        if (!introMessage) return null;
        
        const isCompact = isMobile && isLandscape;
        
        return (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: isCompact ? '95%' : '600px',
          padding: isCompact ? '5px' : '20px',
          height: isCompact ? 'calc(100vh - 50px)' : 'auto',
          overflow: isCompact ? 'hidden' : 'visible'
        }}>
          <div style={{ 
            textAlign: 'center',
            background: 'rgba(0, 0, 0, 0.95)',
            padding: isCompact ? '10px 15px' : '40px',
            borderRadius: isCompact ? '6px' : '10px',
            border: isCompact ? '2px solid #33ffff' : '3px solid #33ffff',
            boxShadow: '0 0 40px rgba(51, 255, 255, 0.5)',
            width: '100%',
            display: isCompact ? 'flex' : 'block',
            flexDirection: isCompact ? 'row' : 'column',
            gap: isCompact ? '15px' : '0',
            alignItems: isCompact ? 'stretch' : 'center'
          }}>
            {/* Columna izquierda en mobile landscape */}
            <div style={{ flex: isCompact ? 1 : 'none' }}>
              {/* Título del nivel */}
              <h1 style={{ 
                color: '#33ffff', 
                textShadow: '0 0 20px #33ffff', 
                marginBottom: isCompact ? '3px' : '10px',
                fontSize: isCompact ? '18px' : (isMobile ? '28px' : '36px')
              }}>
                {t('level_intro.level')} {level}
              </h1>
              <h2 style={{ 
                color: '#ff00ff', 
                textShadow: '0 0 15px #ff00ff', 
                marginBottom: isCompact ? '8px' : '30px',
                fontSize: isCompact ? '12px' : (isMobile ? '20px' : '24px'),
                fontStyle: 'italic'
              }}>
                "{introMessage.title}"
              </h2>

              {/* Objetivo */}
              <div style={{ 
                marginBottom: isCompact ? '8px' : '25px',
                padding: isCompact ? '6px 8px' : '15px',
                background: 'rgba(51, 255, 255, 0.1)',
                borderRadius: '5px',
                border: '1px solid #33ffff'
              }}>
                <p style={{ 
                  color: '#33ffff', 
                  fontSize: isCompact ? '10px' : (isMobile ? '16px' : '18px'),
                  fontWeight: 'bold',
                  marginBottom: isCompact ? '2px' : '5px'
                }}>
                  {t('level_intro.objective')}
                </p>
                <p style={{ 
                  color: '#ffffff', 
                  fontSize: isCompact ? '12px' : (isMobile ? '18px' : '20px')
                }}>
                  {t('level_intro.collect_prefix')}{introMessage.objective}{t('level_intro.collect_suffix')}
                </p>
              </div>

              {/* Botón COMENZAR - en mobile landscape va aquí */}
              {isCompact && (
                <button 
                  onClick={beginLevel}
                  style={{
                    background: 'rgba(51, 255, 255, 0.2)',
                    border: '2px solid #33ffff',
                    color: '#33ffff',
                    padding: '8px 20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    textShadow: '0 0 10px #33ffff',
                    boxShadow: '0 0 20px rgba(51, 255, 255, 0.5)',
                    transition: 'all 0.3s',
                    width: '100%',
                    marginTop: '5px'
                  }}
                >
                  ▶ {t('level_intro.start')}
                </button>
              )}
            </div>

            {/* Columna derecha en mobile landscape */}
            <div style={{ flex: isCompact ? 1 : 'none' }}>
              {/* Peligros */}
              <div style={{ 
                marginBottom: isCompact ? '8px' : '25px',
                padding: isCompact ? '6px 8px' : '15px',
                background: 'rgba(255, 0, 0, 0.1)',
                borderRadius: '5px',
                border: '1px solid #ff3366'
              }}>
                <p style={{ 
                  color: '#ff3366', 
                  fontSize: isCompact ? '10px' : (isMobile ? '16px' : '18px'),
                  fontWeight: 'bold',
                  marginBottom: isCompact ? '4px' : '10px'
                }}>
                  {t('level_intro.dangers')}
                </p>
                {introMessage.dangers.map((danger, idx) => (
                  <p key={idx} style={{ 
                    color: '#ffaaaa', 
                    fontSize: isCompact ? '10px' : (isMobile ? '14px' : '16px'),
                    marginBottom: isCompact ? '2px' : '5px',
                    textAlign: 'left'
                  }}>
                    • {danger}
                  </p>
                ))}
              </div>

              {/* Consejo - oculto en mobile landscape para ahorrar espacio */}
              {!isCompact && (
                <div style={{ 
                  marginBottom: '30px',
                  padding: '15px',
                  background: 'rgba(255, 215, 0, 0.1)',
                  borderRadius: '5px',
                  border: '1px solid #FFD700'
                }}>
                  <p style={{ 
                    color: '#FFD700', 
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: 'bold',
                    marginBottom: '10px'
                  }}>
                    {t('level_intro.tip_label')}
                  </p>
                  <p style={{ 
                    color: '#ffffaa', 
                    fontSize: isMobile ? '14px' : '16px',
                    lineHeight: '1.5',
                    textAlign: 'left'
                  }}>
                    {introMessage.tip}
                  </p>
                </div>
              )}
            </div>

            {/* Botón COMENZAR - en desktop/mobile portrait va al final */}
            {!isCompact && (
              <button 
                onClick={beginLevel}
                style={{
                  background: 'transparent',
                  border: '3px solid #33ffff',
                  color: '#33ffff',
                  padding: '15px 50px',
                  fontSize: isMobile ? '18px' : '22px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  textShadow: '0 0 10px #33ffff',
                  boxShadow: '0 0 30px rgba(51, 255, 255, 0.5)',
                  transition: 'all 0.3s',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(51, 255, 255, 0.2)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                {t('level_intro.start')}
              </button>
            )}
          </div>
        </div>
        );
      })()}

      {/* Nivel completado: se muestra el mismo layout que el menú (arriba) con gameState === 'levelComplete', sin duplicar panel */}
      {false && gameState === 'levelComplete' && (
        <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '30px',
            flex: '1',
            minWidth: '300px'
          }}>
            {/* Primera fila: 3 rankings arriba */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'row',
              gap: '20px',
              width: '100%',
              flexWrap: 'wrap'
            }}>
            {/* Ranking por XP */}
            <div style={{ 
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '20px',
              borderRadius: '10px',
              border: '2px solid #FFD700',
              boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
              flex: '1',
              minWidth: '250px'
            }}>
              <h2 style={{ 
                color: '#FFD700', 
                textShadow: '0 0 20px #FFD700', 
                textAlign: 'center',
                marginBottom: '15px',
                fontSize: '20px'
              }}>
                🏆 RANKING XP
              </h2>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {leaderboard.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #FFD700' }}>
                        <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>Usuario</th>
                        <th style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>XP</th>
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
                          <td style={{ padding: '8px', color: index < 3 ? '#FFD700' : '#33ffff', fontSize: '13px' }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td style={{ padding: '8px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '13px' }}>
                            {entry.username}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '13px' }}>
                            {entry.totalXp?.toLocaleString() || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Ranking combinado: Rebirth, Nivel y Niveles Totales */}
            {(() => {
              // Combinar datos de ambos leaderboards
              const combinedData = [];
              const userMap = new Map();
              
              // Agregar datos de rebirth
              leaderboardByRebirth.forEach(entry => {
                userMap.set(entry.username, {
                  username: entry.username,
                  rebirthCount: entry.rebirthCount || 0,
                  highestLevel: 0,
                  totalSessions: entry.totalSessions || 0
                });
              });
              
              // Agregar/actualizar datos de nivel
              leaderboardByLevel.forEach(entry => {
                if (userMap.has(entry.username)) {
                  userMap.get(entry.username).highestLevel = entry.highestLevel || 1;
                  userMap.get(entry.username).totalSessions = entry.totalSessions || userMap.get(entry.username).totalSessions || 0;
                } else {
                  userMap.set(entry.username, {
                    username: entry.username,
                    rebirthCount: 0,
                    highestLevel: entry.highestLevel || 1,
                    totalSessions: entry.totalSessions || 0
                  });
                }
              });
              
              // Convertir a array y ordenar: primero por rebirth (desc), luego por nivel (desc)
              combinedData.push(...Array.from(userMap.values()));
              combinedData.sort((a, b) => {
                if (b.rebirthCount !== a.rebirthCount) {
                  return b.rebirthCount - a.rebirthCount;
                }
                return (b.highestLevel || 1) - (a.highestLevel || 1);
              });
              
              return (
                <div style={{ 
                  background: 'rgba(0, 0, 0, 0.7)',
                  padding: '20px',
                  borderRadius: '10px',
                  border: '2px solid #33ffff',
                  boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
                  flex: '2', // Ocupa dos casilleros
                  minWidth: '500px'
                }}>
                  <h2 style={{ 
                    color: '#33ffff', 
                    textShadow: '0 0 20px #33ffff', 
                    textAlign: 'center',
                    marginBottom: '15px',
                    fontSize: '20px'
                  }}>
                    🔄⭐ RANKING REBIRTH & NIVEL
                  </h2>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {combinedData.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #33ffff' }}>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#33ffff', fontSize: '12px' }}>#</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#33ffff', fontSize: '12px' }}>Usuario</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#ff3366', fontSize: '12px' }}>Rebirth</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '12px' }}>Nivel</th>
                            <th style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>Niveles Totales</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedData.map((entry, index) => (
                            <tr 
                              key={entry.username}
                              style={{ 
                                borderBottom: '1px solid rgba(51, 255, 255, 0.2)',
                                backgroundColor: entry.username === user?.username ? 'rgba(51, 255, 255, 0.1)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '8px', color: index < 3 ? '#33ffff' : '#FFD700', fontSize: '13px' }}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                              </td>
                              <td style={{ padding: '8px', color: entry.username === user?.username ? '#33ffff' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '13px' }}>
                                {entry.username}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#ff3366', fontSize: '13px' }}>
                                {entry.rebirthCount || 0}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '13px' }}>
                                {entry.highestLevel || 1}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '13px' }}>
                                {entry.totalSessions || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>

            {/* Segunda fila: 3 rankings abajo */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'row',
              gap: '20px',
              width: '100%',
              flexWrap: 'wrap'
            }}>
              {/* Ranking por XP Total */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '10px',
                border: '2px solid #00ff88',
                boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
                flex: '1',
                minWidth: '250px'
              }}>
                <h2 style={{ 
                  color: '#00ff88', 
                  textShadow: '0 0 20px #00ff88', 
                  textAlign: 'center',
                  marginBottom: '15px',
                  fontSize: '20px'
                }}>
                  💎 XP TOTAL
                </h2>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {leaderboardByTotalXP.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #00ff88' }}>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#00ff88', fontSize: '12px' }}>#</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#00ff88', fontSize: '12px' }}>Usuario</th>
                          <th style={{ padding: '8px', textAlign: 'right', color: '#00ff88', fontSize: '12px' }}>XP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardByTotalXP.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(0, 255, 136, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px', color: index < 3 ? '#00ff88' : '#33ffff', fontSize: '13px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '8px', color: entry.username === user?.username ? '#00ff88' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '13px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#33ffff', fontSize: '13px' }}>
                              {entry.totalXp?.toLocaleString() || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Ranking por Estrellas Totales */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '10px',
                border: '2px solid #FFD700',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)',
                flex: '1',
                minWidth: '250px'
              }}>
                <h2 style={{ 
                  color: '#FFD700', 
                  textShadow: '0 0 20px #FFD700', 
                  textAlign: 'center',
                  marginBottom: '15px',
                  fontSize: '20px'
                }}>
                  ⭐ ESTRELLAS TOTALES
                </h2>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {leaderboardByTotalStars.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #FFD700' }}>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>#</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#FFD700', fontSize: '12px' }}>Usuario</th>
                          <th style={{ padding: '8px', textAlign: 'right', color: '#FFD700', fontSize: '12px' }}>Estrellas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardByTotalStars.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px', color: index < 3 ? '#FFD700' : '#ffff00', fontSize: '13px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '8px', color: entry.username === user?.username ? '#FFD700' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '13px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#ffff00', fontSize: '13px' }}>
                              {entry.totalStars?.toLocaleString() || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Ranking por Serie */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '10px',
                border: '2px solid #ff00ff',
                boxShadow: '0 0 30px rgba(255, 0, 255, 0.3)',
                flex: '1',
                minWidth: '250px'
              }}>
                <h2 style={{ 
                  color: '#ff00ff', 
                  textShadow: '0 0 20px #ff00ff', 
                  textAlign: 'center',
                  marginBottom: '15px',
                  fontSize: '20px'
                }}>
                  🔢 SERIE
                </h2>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {leaderboardBySeries.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#888' }}>Cargando...</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #ff00ff' }}>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#ff00ff', fontSize: '12px' }}>#</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#ff00ff', fontSize: '12px' }}>Usuario</th>
                          <th style={{ padding: '8px', textAlign: 'right', color: '#ff00ff', fontSize: '12px' }}>Serie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardBySeries.map((entry, index) => (
                          <tr 
                            key={index}
                            style={{ 
                              borderBottom: '1px solid rgba(255, 0, 255, 0.2)',
                              backgroundColor: entry.username === user?.username ? 'rgba(255, 0, 255, 0.1)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px', color: index < 3 ? '#ff00ff' : '#ff88ff', fontSize: '13px' }}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td style={{ padding: '8px', color: entry.username === user?.username ? '#ff00ff' : '#fff', fontWeight: entry.username === user?.username ? 'bold' : 'normal', fontSize: '13px' }}>
                              {entry.username}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', color: '#ff88ff', fontSize: '13px' }}>
                              {entry.currentSeries || 1}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Chat */}
            <div style={{ 
              marginTop: '15px',
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #33ffff',
              boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
              width: '100%'
            }}>
              <h2 style={{ 
                color: '#33ffff', 
                textShadow: '0 0 20px #33ffff', 
                textAlign: 'center',
                marginBottom: '10px',
                fontSize: '14px'
              }}>
                💬 CHAT
              </h2>
              
              {/* Messages container */}
              <div 
                id="chat-messages-level"
                style={{ 
                  maxHeight: '150px',
                  overflowY: 'auto',
                  marginBottom: '10px',
                  padding: '8px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '5px',
                  border: '1px solid rgba(51, 255, 255, 0.2)'
                }}
              >
                {chatMessages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>No hay mensajes aún. ¡Sé el primero en escribir!</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      style={{ 
                        marginBottom: '10px',
                        padding: '8px',
                        background: msg.userId === user?.id ? 'rgba(51, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '5px',
                        borderLeft: `3px solid ${msg.userId === user?.id ? '#33ffff' : '#888'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ 
                          color: msg.userId === user?.id ? '#33ffff' : '#fff', 
                          fontWeight: 'bold',
                      fontSize: '11px'
                    }}>
                      {msg.username}
                    </span>
                    <span style={{ color: '#888', fontSize: '9px' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: '#fff', fontSize: '11px', wordBreak: 'break-word' }}>
                    {msg.message}
                  </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder={user ? "Escribe un mensaje..." : "Inicia sesión para chatear"}
                  disabled={!user}
                  maxLength={500}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: '2px solid #33ffff',
                    borderRadius: '5px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!user || !chatInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: user && chatInput.trim() ? 'transparent' : 'rgba(51, 255, 255, 0.2)',
                    border: '2px solid #33ffff',
                    borderRadius: '5px',
                    color: user && chatInput.trim() ? '#33ffff' : '#888',
                    fontSize: '12px',
                    cursor: user && chatInput.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    if (user && chatInput.trim()) {
                      e.target.style.background = 'rgba(51, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (user && chatInput.trim()) {
                      e.target.style.background = 'transparent';
                    }
                  }}
                >
                  Enviar
                </button>
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
                marginBottom: '15px',
                filter: 'drop-shadow(0 0 10px rgba(255, 51, 102, 0.8))'
              }}>
                <img src="/assets/rebirth.webp" alt="Rebirth" style={{ width: '48px', height: '48px' }} />
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
              // Resetear el estado del juego COMPLETAMENTE para que se reinicie desde cero
              gameRef.current.gameStartTime = null;
              gameRef.current.enemies = [];
              gameRef.current.snake = [];
              gameRef.current.food = [];
              gameRef.current.stars = [];
              gameRef.current.bullets = [];
              gameRef.current.particles = [];
              gameRef.current.killerSaws = [];
              gameRef.current.floatingCannons = [];
              gameRef.current.resentfulSnakes = [];
              gameRef.current.healthBoxes = [];
              gameRef.current.structures = [];
              // Resetear dirección para evitar estado residual
              gameRef.current.direction = { x: 1, y: 0 };
              gameRef.current.nextDirection = { x: 1, y: 0 };
              // Resetear joystick
              joystickRef.current.isActive = false;
              joystickRef.current.direction = { x: 0, y: 0 };
              joystickRef.current.intensity = 0;
              setJoystickActive(false);
              setJoystickDirection({ x: 0, y: 0 });
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
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0a0a0a',
          minHeight: 0
        }}>
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            style={{
              width: (isMobile && isLandscape) ? '100%' : (isMobile ? '100%' : '100%'),
              height: (isMobile && isLandscape) ? '100%' : (isMobile ? '100%' : '100%'),
              maxWidth: '100%',
              maxHeight: '100%',
              border: isMobile ? '2px solid #33ffff' : '3px solid #33ffff',
              boxShadow: isMobile ? '0 0 20px rgba(51, 255, 255, 0.4)' : '0 0 40px rgba(51, 255, 255, 0.4)',
              borderRadius: '0',
              display: 'block',
              imageRendering: 'pixelated',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
          />
          
          {/* Mobile Landscape Controls - Shoot LEFT, Joystick RIGHT - floating over canvas */}
          {isMobile && gameState === 'playing' && isLandscape && (
            <>
              {/* Joystick - RIGHT side, bottom */}
              <div
                style={{
                  position: 'absolute',
                  right: '20px',
                  bottom: '20px',
                  width: '100px',
                  height: '100px',
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              >
                {/* Joystick Base */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100px',
                    height: '100px',
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
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    background: joystickActive 
                      ? 'rgba(51, 255, 255, 0.9)' 
                      : 'rgba(51, 255, 255, 0.4)',
                    border: '2px solid #33ffff',
                    boxShadow: joystickActive 
                      ? '0 0 20px rgba(51, 255, 255, 0.8)' 
                      : '0 0 10px rgba(51, 255, 255, 0.4)',
                    left: joystickActive && (joystickDirection.x !== 0 || joystickDirection.y !== 0)
                      ? `${50 + joystickDirection.x * 27}px`
                      : '50%',
                    top: joystickActive && (joystickDirection.x !== 0 || joystickDirection.y !== 0)
                      ? `${50 + joystickDirection.y * 27}px`
                      : '50%',
                    transform: 'translate(-50%, -50%)',
                    transition: joystickActive ? 'none' : 'all 0.2s ease-out',
                    pointerEvents: 'none'
                  }}
                />
              </div>

              {/* Shoot Button - LEFT side, bottom */}
              {cannonLevel > 0 && (
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isShootingRef.current && shootBulletRef.current) {
                      isShootingRef.current = true;
                      shootBulletRef.current();
                      if (startAutoFireRef.current) startAutoFireRef.current();
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (stopAutoFireRef.current) stopAutoFireRef.current();
                  }}
                  onClick={(e) => {
                    // Fallback para Safari iOS que a veces ignora onTouchStart
                    e.preventDefault();
                    e.stopPropagation();
                    if (shootBulletRef.current) {
                      shootBulletRef.current();
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: '20px',
                    bottom: '20px',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(255, 51, 102, 0.6)',
                    border: '3px solid rgba(255, 51, 102, 0.8)',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(255, 51, 102, 0.5)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    transition: 'all 0.1s ease',
                    fontSize: '24px',
                    padding: '0'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!isShootingRef.current && shootBulletRef.current) {
                      isShootingRef.current = true;
                      shootBulletRef.current();
                      if (startAutoFireRef.current) startAutoFireRef.current();
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
                >
                  🎯
                </button>
              )}
            </>
          )}
          
          {/* Mobile Portrait - Show rotate message */}
          {isMobile && gameState === 'playing' && !isLandscape && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
                textAlign: 'center'
              }}
            >
              <div style={{ 
                fontSize: '80px', 
                marginBottom: '20px',
                animation: 'rotate-phone 1.5s ease-in-out infinite'
              }}>
                📱
              </div>
              <style>
                {`
                  @keyframes rotate-phone {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-30deg); }
                    75% { transform: rotate(30deg); }
                  }
                `}
              </style>
              <h2 style={{ 
                color: '#33ffff', 
                textShadow: '0 0 20px #33ffff',
                fontSize: '24px',
                marginBottom: '15px'
              }}>
                ¡Gira tu teléfono!
              </h2>
              <p style={{ 
                color: '#aaa', 
                fontSize: '16px',
                maxWidth: '280px',
                lineHeight: '1.5'
              }}>
                Para una mejor experiencia, juega en modo horizontal (landscape)
              </p>
              <div style={{
                marginTop: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                color: '#666'
              }}>
                <span style={{ fontSize: '40px', opacity: 0.5 }}>📱</span>
                <span style={{ fontSize: '24px' }}>→</span>
                <span style={{ 
                  fontSize: '40px', 
                  transform: 'rotate(90deg)',
                  color: '#33ffff'
                }}>📱</span>
              </div>
            </div>
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
                {t('game.shop')}
              </h2>
              <p style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center' }}>
                {t('game.xp_total')}: {totalXP} | {t('game.stars_total')}: {totalStars}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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

                {/* Cabeza XP */}
                {(() => {
                  const next = getNextUpgrade('head');
                  const currentLevel = headLevel;
                  return (
                <div style={{ 
                      border: '2px solid #9400D3', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 1 ? 'rgba(148, 0, 211, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Zap size={48} style={{ color: '#9400D3', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: '#9400D3', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        CABEZA XP {currentLevel > 1 ? `Nivel ${currentLevel}` : ''}
                      </h3>
                      {next ? (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp > 0 && `${next.cost.xp} XP`} {next.cost.stars > 0 && `${next.cost.stars}⭐`}
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={(next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)}
                    style={{
                      background: 'transparent',
                              border: '2px solid #9400D3',
                              color: '#9400D3',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: ((next.cost.xp > 0 && totalXP < next.cost.xp) || (next.cost.stars > 0 && totalStars < next.cost.stars)) ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            {t('game.buy_level')} {next.level}
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
                            {next.cost.xp === 0 && next.cost.stars === 0 && t('game.free')}
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
                            {t('game.buy_level')} {next.level}
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
