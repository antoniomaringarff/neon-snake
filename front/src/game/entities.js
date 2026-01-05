// Funciones para crear entidades del juego (enemigos, comida, estructuras, etc.)
import { FOOD_SIZE } from './constants.js';

/**
 * Crea un punto de comida (XP)
 */
export const createFood = (worldWidth, worldHeight, forceColor = null, forceValue = null) => {
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
  const sizeIndex = Math.floor(Math.random() * 5); // 0-4
  const sizeMultiplier = 0.6 + (sizeIndex * 0.2); // 0.6, 0.8, 1.0, 1.2, 1.4
  
  // Calculate XP based on color base XP and size
  const baseXP = tier.xp;
  const xpValue = forceValue || (baseXP + sizeIndex);
  
  return {
    x: Math.random() * (worldWidth - 40) + 20,
    y: Math.random() * (worldHeight - 40) + 20,
    value: xpValue,
    color: tier.color,
    hue: tier.hue,
    size: FOOD_SIZE * sizeMultiplier,
    sizeIndex: sizeIndex
  };
};

/**
 * Calcula mejoras de enemigo basado en nivel y configuración
 */
const getEnemyUpgrades = (level, configUpgradeLevel) => {
  const maxUpgradeLevel = configUpgradeLevel ?? Math.min(10, Math.ceil(level / 2.5));
  
  if (maxUpgradeLevel === 0) {
    return { shieldLevel: 0, cannonLevel: 0, speedLevel: 0, bulletSpeedLevel: 0, magnetLevel: 0, healthLevel: 0 };
  }
  
  const upgradeChance = Math.min(1, 0.2 + (maxUpgradeLevel * 0.08));
  
  const getUpgradeLevel = (maxPossible) => {
    if (Math.random() > upgradeChance) return 0;
    const variance = Math.floor(Math.random() * 9) - 4; // -4 a +4
    const targetLevel = maxUpgradeLevel + variance;
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

/**
 * Crea un enemigo (víbora enemiga)
 */
export const createEnemy = (worldWidth, worldHeight, levelConfig, gameLevel = 1) => {
  const x = Math.random() * worldWidth;
  const y = Math.random() * worldHeight;
  const angle = Math.random() * Math.PI * 2;
  const baseLength = 15 + Math.random() * 20;
  const initialXP = Math.floor(baseLength * 2);
  
  const upgrades = getEnemyUpgrades(gameLevel, levelConfig.enemyUpgradeLevel);
  const enemyMaxHealth = 2 + (upgrades.healthLevel * 2);
  const canShoot = upgrades.cannonLevel > 0;
  const hasShield = upgrades.shieldLevel > 0;
  const baseSpeed = levelConfig.enemySpeed + (Math.random() * 0.5);
  const speedBonus = 1 + (upgrades.speedLevel * 0.1);
  
  return {
    segments: [{ x, y }],
    direction: { x: Math.cos(angle), y: Math.sin(angle) },
    speed: baseSpeed * speedBonus,
    baseSpeed: baseSpeed,
    length: baseLength,
    hue: Math.random() * 360,
    totalXP: initialXP,
    currentHealth: enemyMaxHealth,
    maxHealth: enemyMaxHealth,
    healthLevel: upgrades.healthLevel,
    starsEaten: 0,
    shieldLevel: upgrades.shieldLevel,
    cannonLevel: upgrades.cannonLevel,
    speedLevel: upgrades.speedLevel,
    bulletSpeedLevel: upgrades.bulletSpeedLevel,
    magnetLevel: upgrades.magnetLevel,
    canShoot: canShoot,
    hasShield: hasShield,
    lastShotTime: 0,
    shootCooldown: Math.max(500, levelConfig.enemyShootCooldown * (1 - upgrades.bulletSpeedLevel * 0.1))
  };
};

/**
 * Crea una sierra asesina
 */
export const createKillerSaw = (worldWidth, worldHeight, levelConfig) => {
  const sizes = [20, 30, 40, 50, 60];
  const sizeDamages = [1, 2, 3, 4, 5];
  const colors = ['#ffdd00', '#ffaa00', '#ff6600', '#ff3300', '#ff0000'];
  
  const sizeIndex = Math.floor(Math.random() * sizes.length);
  const size = sizes[sizeIndex];
  const damage = sizeDamages[sizeIndex];
  const color = colors[sizeIndex];
  
  return {
    x: Math.random() * (worldWidth - size * 2) + size,
    y: Math.random() * (worldHeight - size * 2) + size,
    radius: size,
    color: color,
    damage: damage,
    rotation: 0,
    rotationSpeed: 0.05 + Math.random() * 0.05,
    velocity: {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2
    },
    speed: 1 + Math.random()
  };
};

/**
 * Crea un cañón flotante
 */
export const createFloatingCannon = (worldWidth, worldHeight, levelConfig) => {
  return {
    x: Math.random() * (worldWidth - 100) + 50,
    y: Math.random() * (worldHeight - 100) + 50,
    angle: Math.random() * Math.PI * 2,
    shootCooldown: 0,
    shootInterval: 2000 + Math.random() * 1000,
    range: 400,
    bulletSpeed: 5
  };
};

/**
 * Crea una víbora resentida (BOSS)
 */
export const createResentfulSnake = (worldWidth, worldHeight, levelConfig) => {
  const margin = 200;
  const x = margin + Math.random() * (worldWidth - margin * 2);
  const y = margin + Math.random() * (worldHeight - margin * 2);
  const angle = Math.random() * Math.PI * 2;
  
  return {
    segments: [{ x, y }],
    direction: { x: Math.cos(angle), y: Math.sin(angle) },
    speed: levelConfig.enemySpeed * 1.8,
    length: 25 + Math.random() * 10,
    hue: 0,
    rainbowOffset: Math.random() * 360,
    isResentful: true,
    lastShotTime: 0,
    shootCooldown: 400,
    chaseRange: 800,
    bulletSpeed: 10
  };
};

/**
 * Crea una caja de salud
 */
export const createHealthBox = (worldWidth, worldHeight, levelConfig) => {
  const sizes = [1, 3, 5];
  const sizeIndex = Math.floor(Math.random() * sizes.length);
  
  return {
    x: Math.random() * (worldWidth - 40) + 20,
    y: Math.random() * (worldHeight - 40) + 20,
    healthPoints: sizes[sizeIndex],
    size: 15 + sizeIndex * 5,
    pulse: 0,
    pulseSpeed: 0.05
  };
};
