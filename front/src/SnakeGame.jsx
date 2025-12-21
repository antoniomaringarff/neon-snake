import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Shield, Zap } from 'lucide-react';

const SnakeGame = ({ user, onLogout }) => {
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [gameState, setGameState] = useState('menu'); // menu, playing, levelComplete, gameOver, shop
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [totalXP, setTotalXP] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [currentLevelStars, setCurrentLevelStars] = useState(0);
  const [currentLevelXP, setCurrentLevelXP] = useState(0);
  const [shieldLevel, setShieldLevel] = useState(0); // 0 = none, 1 = basic, 2 = advanced
  const [headLevel, setHeadLevel] = useState(1); // 1 = normal, 2 = double, 3 = triple
  const [cannonLevel, setCannonLevel] = useState(0); // 0 = none, 1 = single, 2 = double
  const [shopOpen, setShopOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  
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
    sessionXP: 0
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

  // Load leaderboard
  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/leaderboard?type=score&limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoadingLeaderboard(false);
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
      setHeadLevel(data.headLevel || 1);
      setCannonLevel(data.cannonLevel || 0);
      gameRef.current.level = data.currentLevel || 1;
      
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load leaderboard when game over
  useEffect(() => {
    if (gameState === 'gameOver') {
      loadLeaderboard();
    }
  }, [gameState]);

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
          cannonLevel,
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
    if (!user?.id) return;

    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          score: finalScore,
          levelReached,
          xpEarned,
          durationSeconds
        })
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  // Load progress on mount
  useEffect(() => {
    loadUserProgress();
  }, [user?.id]);

  // Auto-save progress when it changes (debounced)
  useEffect(() => {
    if (loading) return; // Don't save while loading initial data
    
    const timeoutId = setTimeout(() => {
      saveUserProgress();
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [totalXP, totalStars, level, shieldLevel, headLevel, cannonLevel]);

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
    const createEnemy = () => {
      const x = Math.random() * WORLD_WIDTH;
      const y = Math.random() * WORLD_HEIGHT;
      const angle = Math.random() * Math.PI * 2;
    const baseLength = 15 + Math.random() * 20;
    const initialXP = Math.floor(baseLength * 2); // Initial XP based on length
    // Health based on XP: 1 bullet per 10 XP
    const health = Math.max(1, Math.ceil(initialXP / 10));
    // Some enemies can shoot (30% chance)
    const canShoot = Math.random() < 0.3;
      return {
        segments: [{ x, y }],
        direction: { x: Math.cos(angle), y: Math.sin(angle) },
        speed: 2 + Math.random(),
      length: baseLength,
      hue: Math.random() * 360,
      totalXP: initialXP, // Track XP accumulated by this enemy
      health: health, // Health points (1 bullet per 10 XP)
      maxHealth: health,
      canShoot: canShoot, // Can this enemy shoot?
      lastShotTime: 0, // Track when enemy last shot
      shootCooldown: 2000 + Math.random() * 3000 // 2-5 seconds between shots
    };
  };

  // Shoot bullet function - must be outside useEffect to be accessible from button
  const shootBullet = () => {
    const game = gameRef.current;
    if (!game.snake || game.snake.length === 0) return;
    const head = game.snake[0];
    const bulletCount = cannonLevel === 2 ? 2 : 1;
    
    for (let i = 0; i < bulletCount; i++) {
      const offset = bulletCount === 2 ? (i === 0 ? -15 : 15) : 0;
      const angle = Math.atan2(game.direction.y, game.direction.x);
      const perpAngle = angle + Math.PI / 2;
      
      game.bullets.push({
        x: head.x + Math.cos(perpAngle) * offset,
        y: head.y + Math.sin(perpAngle) * offset,
        vx: game.direction.x * 8,
        vy: game.direction.y * 8,
        life: 100,
        owner: 'player'
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationId;

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
      game.snake = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }];
      game.direction = { x: 1, y: 0 };
      game.nextDirection = { x: 1, y: 0 };
      game.food = Array.from({ length: 15 }, createFood);
      game.stars = []; // Reset stars
      game.enemies = Array.from({ length: 2 + game.level }, createEnemy);
      game.particles = [];
      game.currentXP = 0;
      game.currentStars = 0;
      game.starsNeeded = game.level; // Need N stars for level N
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

    const handleTouchMove = (e) => {
      e.preventDefault(); // Prevent scrolling
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateMousePos(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e) => {
      e.preventDefault(); // Prevent scrolling
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateMousePos(touch.clientX, touch.clientY);
      }
    };

    const handleKeyPress = (e) => {
      if (e.key.toLowerCase() === 'j') {
        setShopOpen(prev => !prev);
      } else if (e.key === ' ' && cannonLevel > 0) {
        e.preventDefault();
        shootBullet();
      }
    };

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
    const createFoodFromEnemy = (x, y, totalXP) => {
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
      
      // Create a golden star at the death location
      gameRef.current.stars.push({
        x: x,
        y: y,
        size: 20,
        rotation: 0,
        rotationSpeed: 0.02,
        pulse: 0,
        pulseSpeed: 0.05
      });
    };

    const updateEnemies = () => {
      const game = gameRef.current;
      const enemiesToRemove = [];
      
      game.enemies.forEach((enemy, enemyIndex) => {
        // Random direction change
        if (Math.random() < 0.02) {
          const angle = Math.random() * Math.PI * 2;
          enemy.direction = { x: Math.cos(angle), y: Math.sin(angle) };
        }

        const head = enemy.segments[0];
        let newX = head.x + enemy.direction.x * enemy.speed;
        let newY = head.y + enemy.direction.y * enemy.speed;

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

        // Check collision: Player head vs Enemy body (excluding enemy head)
        // If player head hits enemy body, PLAYER dies
        const playerHead = game.snake[0];
        for (let i = 1; i < enemy.segments.length; i++) {
          if (checkCollision(playerHead, enemy.segments[i], game.snakeSize + SNAKE_SIZE)) {
            // Player dies - save session and game over
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(score, level, game.sessionXP, duration);
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
            // Enemy dies - create food and star from its XP
            const deathX = enemyHead.x;
            const deathY = enemyHead.y;
            const enemyXP = enemy.totalXP || (enemy.length * 2); // Base XP on length if no XP tracked
            createFoodFromEnemy(deathX, deathY, enemyXP);
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
              // Other enemy dies - create food and star
              const deathX = otherHead.x;
              const deathY = otherHead.y;
              const enemyXP = otherEnemy.totalXP || (otherEnemy.length * 2);
              createFoodFromEnemy(deathX, deathY, enemyXP);
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
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.life--;
        
        // Check collision with enemies (player bullets)
        if (bullet.owner === 'player') {
        let hit = false;
          game.enemies.forEach((enemy, enemyIndex) => {
          if (!hit && enemy.segments.length > 0) {
              // Check collision with enemy head (most important)
              const enemyHead = enemy.segments[0];
              if (checkCollision(bullet, enemyHead, 15)) {
                // Reduce health
                enemy.health -= 1;
                createParticle(bullet.x, bullet.y, '#ffff00', 8);
                hit = true;
                
                // If health reaches 0, mark enemy for death
                if (enemy.health <= 0) {
                  const deathX = enemyHead.x;
                  const deathY = enemyHead.y;
                  const enemyXP = enemy.totalXP || (enemy.length * 2);
                  createFoodFromEnemy(deathX, deathY, enemyXP);
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
          if (checkCollision(bullet, playerHead, 15)) {
            // Calculate resistance based on shield level
            let resistance = 1; // Base: 1 bullet = 1 damage
            if (shieldLevel === 1) {
              resistance = 2; // Double resistance
            } else if (shieldLevel === 2) {
              resistance = 3; // Triple resistance
            }
            
            // Apply damage (1 bullet = 1/resistance damage)
            // For now, we'll just create a particle effect
            // In the future, you might want to add a health system for the player
            createParticle(bullet.x, bullet.y, '#ff0000', 8);
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
      
      // Make enemies shoot
      const currentTime = Date.now();
      game.enemies.forEach((enemy, enemyIndex) => {
        if (enemy.canShoot && enemy.segments.length > 0 && game.snake.length > 0) {
          // Check if cooldown has passed
          if (currentTime - enemy.lastShotTime >= enemy.shootCooldown) {
            const enemyHead = enemy.segments[0];
            const playerHead = game.snake[0];
            
            // Calculate direction to player
            const dx = playerHead.x - enemyHead.x;
            const dy = playerHead.y - enemyHead.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only shoot if player is within range (500 units)
            if (distance < 500 && distance > 50) {
              const angle = Math.atan2(dy, dx);
              const speed = 5;
              
              game.bullets.push({
                x: enemyHead.x,
                y: enemyHead.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 120, // 2 seconds at 60fps
                owner: 'enemy'
              });
              
              enemy.lastShotTime = currentTime;
              enemy.shootCooldown = 2000 + Math.random() * 3000; // Reset cooldown
            }
          }
        }
      });
    };

    const update = () => {
      if (gameState !== 'playing' || shopOpen) return; // Pause when shop is open

      const game = gameRef.current;
      
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
            opening.position += opening.direction * opening.speed;
            
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
      
      // Convert mouse position to world coordinates
      const worldMouseX = game.mousePos.x + game.camera.x;
      const worldMouseY = game.mousePos.y + game.camera.y;
      
      // Calculate direction towards mouse
      const head = game.snake[0];
      const dx = worldMouseX - head.x;
      const dy = worldMouseY - head.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Smooth turning - interpolate between current and target direction
      if (distance > 5) {
        const targetDir = {
          x: dx / distance,
          y: dy / distance
        };
        
        // Lerp factor for smooth turning
        const smoothFactor = 0.15;
        game.direction.x += (targetDir.x - game.direction.x) * smoothFactor;
        game.direction.y += (targetDir.y - game.direction.y) * smoothFactor;
        
        // Normalize to maintain constant speed
        const dirLength = Math.sqrt(game.direction.x * game.direction.x + game.direction.y * game.direction.y);
        game.direction.x /= dirLength;
        game.direction.y /= dirLength;
      }

      const newHead = {
        x: head.x + game.direction.x * game.speed,
        y: head.y + game.direction.y * game.speed
      };

      // Check collision with red borders - instant death
      if (newHead.x < BORDER_WIDTH || newHead.x > WORLD_WIDTH - BORDER_WIDTH ||
          newHead.y < BORDER_WIDTH || newHead.y > WORLD_HEIGHT - BORDER_WIDTH) {
        // Save game session before game over
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
        saveGameSession(score, level, game.sessionXP, duration);
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
              saveGameSession(score, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            // No opening, always die if touching wall
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(score, level, game.sessionXP, duration);
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
              saveGameSession(score, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(score, level, game.sessionXP, duration);
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
              saveGameSession(score, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(score, level, game.sessionXP, duration);
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
              saveGameSession(score, level, game.sessionXP, duration);
              setGameState('gameOver');
              return;
            }
          } else {
            const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
            saveGameSession(score, level, game.sessionXP, duration);
            setGameState('gameOver');
            return;
          }
        }
      }

      game.snake.unshift(newHead);

      // Update camera to follow player
      game.camera.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, newHead.x - CANVAS_WIDTH / 2));
      game.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, newHead.y - CANVAS_HEIGHT / 2));

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
          
          // Increase speed and size slightly when eating
          game.speed = Math.min(game.baseSpeed + game.snake.length * 0.01, game.baseSpeed + 2);
          game.snakeSize = Math.min(SNAKE_SIZE + game.snake.length * 0.05, SNAKE_SIZE + 4);
          
          createParticle(food.x, food.y, food.color, 10);
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
          createParticle(star.x, star.y, '#FFD700', 20);
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

      // Add new food if needed
      while (game.food.length < 100) { // Much more food in the big world!
        game.food.push(createFood());
      }

      // Check level completion - based on stars now
      if (game.currentStars >= game.starsNeeded) {
        // Save game session when completing level
        const duration = game.gameStartTime ? Math.floor((Date.now() - game.gameStartTime) / 1000) : 0;
        saveGameSession(score, level, game.sessionXP, duration);
        
        setGameState('levelComplete');
      }

      updateEnemies();

      // Update particles
      game.particles = game.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
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
      game.enemies.forEach(enemy => {
        enemy.segments.forEach((seg, i) => {
          const screenX = seg.x - camX;
          const screenY = seg.y - camY;
          
          if (screenX > -50 && screenX < CANVAS_WIDTH + 50 && 
              screenY > -50 && screenY < CANVAS_HEIGHT + 50) {
            const alpha = 1 - (i / enemy.segments.length) * 0.5;
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

      // Draw player snake
      game.snake.forEach((seg, i) => {
        const screenX = seg.x - camX;
        const screenY = seg.y - camY;
        const alpha = 1 - (i / game.snake.length) * 0.3;
        
        // Shield visual effects
        if (shieldLevel > 0 && i < 5) {
          const shieldAlpha = shieldLevel === 1 ? 0.3 : 0.6;
          ctx.strokeStyle = `rgba(100, 150, 255, ${alpha * shieldAlpha})`;
          ctx.lineWidth = shieldLevel === 1 ? 3 : 5;
          ctx.beginPath();
          ctx.arc(screenX, screenY, game.snakeSize + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Head color based on level: normal=cyan, double=magenta, triple=purple
        let headColor = '#33ffff';
        if (i === 0 && headLevel === 2) headColor = '#ff00ff';
        if (i === 0 && headLevel === 3) headColor = '#9400D3';
        
        ctx.fillStyle = i === 0 ? headColor : `rgba(51, 255, 255, ${alpha})`;
        ctx.shadowBlur = 15;
        ctx.shadowColor = i === 0 ? headColor : '#33ffff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, game.snakeSize, 0, Math.PI * 2);
        ctx.fill();
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

      // Draw minimap in top-right corner
      const minimapWidth = 120;
      const minimapHeight = 90;
      const minimapX = CANVAS_WIDTH - minimapWidth - 10;
      const minimapY = 60; // Below the top bar
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
      
      ctx.strokeStyle = '#33ffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);
      
      // Draw player position on minimap
      const playerMinimapX = minimapX + (game.snake[0].x / WORLD_WIDTH) * minimapWidth;
      const playerMinimapY = minimapY + (game.snake[0].y / WORLD_HEIGHT) * minimapHeight;
      
      ctx.fillStyle = '#33ffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#33ffff';
      ctx.beginPath();
      ctx.arc(playerMinimapX, playerMinimapY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw HUD - Horizontal level bar at the top
      const barHeight = 50;
      const barPadding = 10;
      
      // Background bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, barHeight);
      
      // Level info text
      ctx.fillStyle = '#33ffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`Nivel ${game.level}`, barPadding, 28);
      
      // Stars progress (replaces XP progress)
      const barStartX = 120;
      const barWidth = CANVAS_WIDTH - barStartX - 180;
      
      ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
      ctx.fillRect(barStartX, barPadding, barWidth, barHeight - barPadding * 2);
      
      ctx.fillStyle = '#FFD700';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FFD700';
      const progressWidth = (barWidth * game.currentStars) / game.starsNeeded;
      ctx.fillRect(barStartX, barPadding, progressWidth, barHeight - barPadding * 2);
      ctx.shadowBlur = 0;
      
      // Stars text on the bar
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      const starsText = `⭐ ${game.currentStars} / ${game.starsNeeded}`;
      const textWidth = ctx.measureText(starsText).width;
      ctx.fillText(starsText, barStartX + barWidth / 2 - textWidth / 2, 32);
      
      // Total XP and Stars on the right
      ctx.fillStyle = '#33ffff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`XP: ${totalXP}`, CANVAS_WIDTH - 200, 20);
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`⭐: ${totalStars}`, CANVAS_WIDTH - 200, 40);
      
      // Shop hint
      ctx.fillStyle = '#ff00ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('[J] Tienda', 10, CANVAS_HEIGHT - 15);
      
      // Cannon hint (if cannon is equipped)
      if (cannonLevel > 0) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('[ESPACIO] Disparar', 120, CANVAS_HEIGHT - 15);
      }
    };

    const gameLoop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(gameLoop);
    };

    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('keydown', handleKeyPress);
      gameLoop();
    }

    return () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchstart', handleTouchStart);
      }
      window.removeEventListener('keydown', handleKeyPress);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [gameState, shieldLevel, headLevel, cannonLevel, totalXP, shopOpen]);

  const startGame = () => {
    gameRef.current.level = level;
    gameRef.current.gameStartTime = Date.now();
    gameRef.current.sessionXP = 0;
    setScore(0);
    initGame();
    setShopOpen(false);
    setGameState('playing');
  };

  const initGame = () => {
    const game = gameRef.current;
    
    // Central rectangle (1 screen size = 800x600)
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
          speed: 0.002, // Slower, continuous speed
          width: 60, 
          height: 20,
          paused: false // Pause when player is passing through
        },
        { 
          side: 'bottom', 
          position: 0.5,
          direction: 1,
          speed: 0.002,
          width: 60, 
          height: 20,
          paused: false
        },
        { 
          side: 'left', 
          position: 0.3,
          direction: 1,
          speed: 0.002,
          width: 20, 
          height: 60,
          paused: false
        },
        { 
          side: 'right', 
          position: 0.7,
          direction: 1,
          speed: 0.002,
          width: 20, 
          height: 60,
          paused: false
        }
      ]
    };
    game.centralRect = centralRect;
    
    // Spawn player outside the central rectangle, in a random location
    let spawnX, spawnY;
    let attempts = 0;
    do {
      // Random position in the world
      spawnX = BORDER_WIDTH + Math.random() * (WORLD_WIDTH - BORDER_WIDTH * 2);
      spawnY = BORDER_WIDTH + Math.random() * (WORLD_HEIGHT - BORDER_WIDTH * 2);
      
      // Check if it's outside the central rectangle (with margin for safety)
      const margin = 50;
      const isOutside = spawnX < centralRect.x - margin || 
                       spawnX > centralRect.x + centralRect.width + margin ||
                       spawnY < centralRect.y - margin || 
                       spawnY > centralRect.y + centralRect.height + margin;
      
      if (isOutside) break;
      attempts++;
    } while (attempts < 50); // Safety limit
    
    // Fallback: spawn in corner if all attempts fail
    if (attempts >= 50) {
      spawnX = BORDER_WIDTH + 100;
      spawnY = BORDER_WIDTH + 100;
    }
    
    game.snake = [{ x: spawnX, y: spawnY }];
    game.direction = { x: 1, y: 0 };
    game.nextDirection = { x: 1, y: 0 };
    game.speed = 2;
    game.baseSpeed = 2;
    game.snakeSize = SNAKE_SIZE;
    game.bullets = [];
    
    // Create regular food across the map
    game.food = Array.from({ length: 100 }, () => createFood());
    
    // Add 50 yellow/orange orbs inside central rectangle
    for (let i = 0; i < 50; i++) {
      const color = Math.random() < 0.5 ? 'yellow' : 'orange';
      const food = createFood(color);
      food.x = centralRect.x + 50 + Math.random() * (centralRect.width - 100);
      food.y = centralRect.y + 50 + Math.random() * (centralRect.height - 100);
      game.food.push(food);
    }
    
    // More enemies based on enemyDensity (default 15)
    game.enemies = Array.from({ length: game.enemyDensity + game.level }, () => {
      return createEnemy();
    });
    game.particles = [];
    game.stars = []; // Reset stars
    game.currentXP = 0;
    game.currentStars = 0;
    game.starsNeeded = game.level; // Need N stars for level N
    game.camera = { 
      x: WORLD_WIDTH / 2 - CANVAS_WIDTH / 2, 
      y: WORLD_HEIGHT / 2 - CANVAS_HEIGHT / 2 
    };
    setCurrentLevelXP(0);
    setCurrentLevelStars(0);
  };

  const nextLevel = () => {
    // Incrementar nivel global del usuario
    const newLevel = level + 1;
    setLevel(newLevel);
    gameRef.current.level = newLevel;
    gameRef.current.starsNeeded = newLevel; // Update stars needed for next level
    gameRef.current.gameStartTime = Date.now();
    gameRef.current.sessionXP = 0;
    gameRef.current.currentStars = 0; // Reset stars for new level
    setScore(0);
    setCurrentLevelStars(0);
    initGame();
    setShopOpen(false);
    setGameState('playing');
    
    // Guardar el nuevo nivel global en la base de datos
    saveUserProgress();
  };

  const buyItem = (item) => {
    // Escalated costs - more expensive
    const costs = {
      shield1: { xp: 300, stars: 0 },      // Escudo nivel 1: solo XP
      shield2: { xp: 600, stars: 0 },      // Escudo nivel 2: solo XP
      head1: { xp: 200, stars: 2 },        // Cabeza nivel 1 (base): XP + estrellas
      head2: { xp: 400, stars: 4 },        // Cabeza nivel 2: XP + estrellas
      head3: { xp: 800, stars: 8 },        // Cabeza nivel 3: XP + estrellas
      cannon1: { xp: 250, stars: 3 },      // Cañón nivel 1: XP + estrellas
      cannon2: { xp: 500, stars: 6 }       // Cañón nivel 2: XP + estrellas
    };
    
    const cost = costs[item];
    if (!cost) return;
    
    if (totalXP >= cost.xp && totalStars >= cost.stars) {
      setTotalXP(prev => prev - cost.xp);
      setTotalStars(prev => prev - cost.stars);
      
      if (item === 'shield1') setShieldLevel(1);
      if (item === 'shield2') setShieldLevel(2);
      if (item === 'head1') setHeadLevel(1); // Base level
      if (item === 'head2') setHeadLevel(2);
      if (item === 'head3') setHeadLevel(3);
      if (item === 'cannon1') setCannonLevel(1);
      if (item === 'cannon2') setCannonLevel(2);
      
      setShopOpen(false);
      
      // Save progress after purchase
      setTimeout(() => saveUserProgress(), 100);
    }
  };
  
  // Helper to get next upgrade level and cost for each type
  const getNextUpgrade = (type) => {
    if (type === 'shield') {
      if (shieldLevel === 0) return { level: 1, item: 'shield1', cost: { xp: 300, stars: 0 }, desc: 'Doble resistencia a balas' };
      if (shieldLevel === 1) return { level: 2, item: 'shield2', cost: { xp: 600, stars: 0 }, desc: 'Triple resistencia a balas' };
      return null; // Max level
    }
    if (type === 'head') {
      if (headLevel === 1) return { level: 2, item: 'head2', cost: { xp: 400, stars: 4 }, desc: 'Come 2x XP, Roba 5 XP' };
      if (headLevel === 2) return { level: 3, item: 'head3', cost: { xp: 800, stars: 8 }, desc: 'Come 3x XP, Roba 10 XP' };
      return null; // Max level
    }
    if (type === 'cannon') {
      if (cannonLevel === 0) return { level: 1, item: 'cannon1', cost: { xp: 250, stars: 3 }, desc: 'Dispara balas [ESPACIO]' };
      if (cannonLevel === 1) return { level: 2, item: 'cannon2', cost: { xp: 500, stars: 6 }, desc: '2 balas por disparo' };
      return null; // Max level
    }
    return null;
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
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center', 
            flexWrap: 'wrap',
            width: '100%'
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
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid #ff3366',
              color: '#ff3366',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              borderRadius: '5px',
              transition: 'all 0.3s',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 51, 102, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
            }}
          >
            Cerrar Sesión
          </button>
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
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            alignItems: 'center', 
            marginLeft: 'auto'
          }}>
            {shieldLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Shield size={iconSize} style={{ color: '#6495ed' }} />
                <span style={{ fontSize: iconTextSize, color: '#6495ed' }}>Escudo {shieldLevel}</span>
              </div>
            )}
            {headLevel > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={iconSize} style={{ color: headLevel === 2 ? '#ff00ff' : '#9400D3' }} />
                <span style={{ fontSize: iconTextSize, color: headLevel === 2 ? '#ff00ff' : '#9400D3' }}>
                  {headLevel === 2 ? 'Doble' : 'Triple'}
                </span>
              </div>
            )}
            {cannonLevel > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={iconSize} style={{ color: '#ffff00' }} />
                <span style={{ fontSize: iconTextSize, color: '#ffff00' }}>
                  Cañón {cannonLevel === 2 ? 'x2' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: 'transparent',
            border: '1px solid #ff3366',
            color: '#ff3366',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            borderRadius: '5px',
            transition: 'all 0.3s',
            marginLeft: '20px'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 51, 102, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'transparent';
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    );
  };

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
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #33ffff',
          boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)'
        }}>
          <p style={{ fontSize: '20px', marginBottom: '30px' }}>
            Mueve el mouse/trackpad para controlar tu víbora<br/>
            Come puntos brillantes para ganar XP<br/>
            Evita chocar con otras serpientes
          </p>
          <button 
            onClick={startGame}
            style={{
              background: 'transparent',
              border: '2px solid #33ffff',
              color: '#33ffff',
              padding: '15px 40px',
              fontSize: '24px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #33ffff',
              boxShadow: '0 0 20px rgba(51, 255, 255, 0.5)',
              marginRight: '10px'
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
              fontSize: '24px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #ff00ff',
              boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)'
            }}
          >
            TIENDA
          </button>
        </div>
      )}

      {gameState === 'shop' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.95)',
          padding: '40px',
          borderRadius: '10px',
          border: '3px solid #ff00ff',
          boxShadow: '0 0 40px rgba(255, 0, 255, 0.5)'
        }}>
          <h2 style={{ color: '#ff00ff', textShadow: '0 0 20px #ff00ff', textAlign: 'center' }}>
            TIENDA
          </h2>
          <p style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center' }}>
            XP Total: {totalXP} | ⭐ Total: {totalStars}
          </p>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Shield - Progressive upgrade */}
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
                  {currentLevel === 0 && next && (
                    <>
                      <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                      <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                        {next.cost.xp} XP
                      </p>
              <button 
                        onClick={() => buyItem(next.item)}
                        disabled={totalXP < next.cost.xp}
                style={{
                  background: 'transparent',
                  border: '2px solid #6495ed',
                  color: '#6495ed',
                  padding: '10px 20px',
                  fontSize: '16px',
                          cursor: totalXP < next.cost.xp ? 'not-allowed' : 'pointer',
                  borderRadius: '5px',
                          opacity: totalXP < next.cost.xp ? 0.5 : 1,
                          width: '100%',
                          marginTop: '10px'
                }}
              >
                        COMPRAR NIVEL {next.level}
              </button>
                    </>
                  )}
                  {currentLevel === 1 && next && (
                    <>
                      <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                      <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                        {next.cost.xp} XP
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={totalXP < next.cost.xp}
                        style={{
                          background: 'transparent',
                          border: '2px solid #6495ed',
                          color: '#6495ed',
                          padding: '10px 20px',
                          fontSize: '16px',
                          cursor: totalXP < next.cost.xp ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: totalXP < next.cost.xp ? 0.5 : 1,
                          width: '100%',
                          marginTop: '10px'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  )}
                  {currentLevel === 2 && (
                    <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
            </div>
              );
            })()}

            {/* Head - Progressive upgrade */}
            {(() => {
              const next = getNextUpgrade('head');
              const currentLevel = headLevel;
              return (
            <div style={{ 
              border: '2px solid #ff00ff', 
              padding: '20px', 
              borderRadius: '10px',
                  background: currentLevel > 1 ? 'rgba(255, 0, 255, 0.2)' : 'transparent',
                  minWidth: '220px'
                }}>
                  <Zap size={48} style={{ color: currentLevel === 2 ? '#ff00ff' : currentLevel === 3 ? '#9400D3' : '#33ffff', display: 'block', margin: '0 auto' }} />
                  <h3 style={{ color: currentLevel === 2 ? '#ff00ff' : currentLevel === 3 ? '#9400D3' : '#33ffff', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                    CABEZA {currentLevel > 1 ? `Nivel ${currentLevel}` : 'Base'}
                  </h3>
                  {next && (
                    <>
                      <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                      <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                        {next.cost.xp} XP + {next.cost.stars}⭐
                      </p>
              <button 
                        onClick={() => buyItem(next.item)}
                        disabled={totalXP < next.cost.xp || totalStars < next.cost.stars}
                style={{
                  background: 'transparent',
                  border: '2px solid #ff00ff',
                  color: '#ff00ff',
                  padding: '10px 20px',
                  fontSize: '16px',
                          cursor: totalXP < next.cost.xp || totalStars < next.cost.stars ? 'not-allowed' : 'pointer',
                  borderRadius: '5px',
                          opacity: totalXP < next.cost.xp || totalStars < next.cost.stars ? 0.5 : 1,
                          width: '100%',
                          marginTop: '10px'
                }}
              >
                        COMPRAR NIVEL {next.level}
              </button>
                    </>
                  )}
                  {!next && (
                    <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
            </div>
              );
            })()}

            {/* Cannon - Progressive upgrade */}
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
                  {next && (
                    <>
                      <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                      <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                        {next.cost.xp} XP + {next.cost.stars}⭐
                      </p>
                      <button 
                        onClick={() => buyItem(next.item)}
                        disabled={totalXP < next.cost.xp || totalStars < next.cost.stars}
                        style={{
                          background: 'transparent',
                          border: '2px solid #ffff00',
                          color: '#ffff00',
                          padding: '10px 20px',
                          fontSize: '16px',
                          cursor: totalXP < next.cost.xp || totalStars < next.cost.stars ? 'not-allowed' : 'pointer',
                          borderRadius: '5px',
                          opacity: totalXP < next.cost.xp || totalStars < next.cost.stars ? 0.5 : 1,
                          width: '100%',
                          marginTop: '10px'
                        }}
                      >
                        COMPRAR NIVEL {next.level}
                      </button>
                    </>
                  )}
                  {!next && (
                    <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                      Nivel Máximo
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          <button 
            onClick={() => setGameState('menu')}
            style={{
              background: 'transparent',
              border: '2px solid #33ffff',
              color: '#33ffff',
              padding: '15px 40px',
              fontSize: '20px',
              cursor: 'pointer',
              borderRadius: '5px'
            }}
          >
            VOLVER
          </button>
        </div>
      )}

      {gameState === 'levelComplete' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #00ff88',
          boxShadow: '0 0 30px rgba(0, 255, 136, 0.5)',
          zIndex: 100
        }}>
          <Sparkles size={64} style={{ color: '#00ff88' }} />
          <h2 style={{ color: '#00ff88', textShadow: '0 0 20px #00ff88', marginBottom: '20px' }}>
            ¡NIVEL COMPLETADO!
          </h2>
          <p style={{ fontSize: '24px', marginBottom: '30px' }}>⭐ Estrellas: {gameRef.current.currentStars}</p>
          <p style={{ fontSize: '20px', marginBottom: '30px' }}>XP Ganado: {gameRef.current.sessionXP}</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
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
                transition: 'all 0.3s'
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
                transition: 'all 0.3s'
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
      )}

      {gameState === 'gameOver' && (
        <div style={{ 
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '40px',
          borderRadius: '10px',
          border: '2px solid #ff3366',
          boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <h2 style={{ color: '#ff3366', textShadow: '0 0 20px #ff3366', marginBottom: '20px' }}>
            GAME OVER
          </h2>
          <p style={{ fontSize: '20px', marginBottom: '10px' }}>Nivel alcanzado: {level}</p>
          <p style={{ fontSize: '20px', marginBottom: '30px' }}>XP Total: {totalXP}</p>
          
          {/* Leaderboard */}
          <div style={{
            background: 'rgba(51, 255, 255, 0.1)',
            border: '1px solid #33ffff',
            borderRadius: '5px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <h3 style={{ 
              color: '#33ffff', 
              textAlign: 'center', 
              marginBottom: '15px',
              fontSize: '18px',
              textShadow: '0 0 10px #33ffff'
            }}>
              🏆 TOP 10 MEJORES PARTIDAS
            </h3>
            {loadingLeaderboard ? (
              <p style={{ textAlign: 'center', color: '#888' }}>Cargando ranking...</p>
            ) : leaderboard.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888' }}>No hay rankings disponibles</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {leaderboard.map((player, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      marginBottom: '5px',
                      background: index < 3 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(51, 255, 255, 0.05)',
                      borderRadius: '3px',
                      border: index < 3 ? '1px solid #FFD700' : '1px solid rgba(51, 255, 255, 0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span style={{ 
                        color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#33ffff',
                        fontWeight: 'bold',
                        minWidth: '30px',
                        fontSize: index < 3 ? '18px' : '14px'
                      }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span style={{ 
                        color: '#fff',
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: index < 3 ? 'bold' : 'normal'
                      }}>
                        {player.username}
                      </span>
                    </div>
                    <span style={{ 
                      color: '#33ffff',
                      fontSize: isMobile ? '12px' : '14px',
                      fontWeight: 'bold'
                    }}>
                      {player.bestScore} XP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              // Save progress before returning to menu
              saveUserProgress();
              setLevel(1);
              setGameState('menu');
            }}
            style={{
              background: 'transparent',
              border: '2px solid #ff3366',
              color: '#ff3366',
              padding: '15px 40px',
              fontSize: isMobile ? '18px' : '24px',
              cursor: 'pointer',
              borderRadius: '5px',
              textShadow: '0 0 10px #ff3366',
              marginTop: '20px',
              width: isMobile ? '100%' : 'auto'
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
          
          {/* Botón de disparo para mobile */}
          {isMobile && cannonLevel > 0 && (
            <button
              onClick={() => {
                const game = gameRef.current;
                if (game.snake.length > 0) {
                  shootBullet();
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const game = gameRef.current;
                if (game.snake.length > 0) {
                  shootBullet();
                }
              }}
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 0, 0.2)',
                border: '3px solid #ffff00',
                color: '#ffff00',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(255, 255, 0, 0.5)',
                zIndex: 100,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                transition: 'all 0.1s'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.9)';
                e.currentTarget.style.background = 'rgba(255, 255, 0, 0.4)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 0, 0.2)';
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 0, 0.2)';
              }}
            >
              💥
            </button>
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
              zIndex: 1000
            }}>
              <h2 style={{ color: '#ff00ff', textShadow: '0 0 20px #ff00ff', textAlign: 'center' }}>
                TIENDA
              </h2>
              <p style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center' }}>
                XP Total: {totalXP} | ⭐ Total: {totalStars}
              </p>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* Shield - Progressive upgrade */}
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
                      {currentLevel === 0 && next && (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp} XP
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={totalXP < next.cost.xp}
                    style={{
                      background: 'transparent',
                      border: '2px solid #6495ed',
                      color: '#6495ed',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: totalXP < next.cost.xp ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: totalXP < next.cost.xp ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      )}
                      {currentLevel === 1 && next && (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp} XP
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={totalXP < next.cost.xp}
                    style={{
                      background: 'transparent',
                      border: '2px solid #6495ed',
                      color: '#6495ed',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: totalXP < next.cost.xp ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: totalXP < next.cost.xp ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      )}
                      {currentLevel === 2 && (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Head - Progressive upgrade */}
                {(() => {
                  const next = getNextUpgrade('head');
                  const currentLevel = headLevel;
                  return (
                <div style={{ 
                  border: '2px solid #ff00ff', 
                      padding: '20px', 
                  borderRadius: '10px',
                      background: currentLevel > 1 ? 'rgba(255, 0, 255, 0.2)' : 'transparent',
                      minWidth: '220px'
                    }}>
                      <Zap size={48} style={{ color: currentLevel === 2 ? '#ff00ff' : currentLevel === 3 ? '#9400D3' : '#33ffff', display: 'block', margin: '0 auto' }} />
                      <h3 style={{ color: currentLevel === 2 ? '#ff00ff' : currentLevel === 3 ? '#9400D3' : '#33ffff', textAlign: 'center', fontSize: '18px', marginTop: '10px' }}>
                        CABEZA {currentLevel > 1 ? `Nivel ${currentLevel}` : 'Base'}
                      </h3>
                      {next && (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp} XP + {next.cost.stars}⭐
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={totalXP < next.cost.xp || totalStars < next.cost.stars}
                    style={{
                      background: 'transparent',
                      border: '2px solid #ff00ff',
                      color: '#ff00ff',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: totalXP < next.cost.xp || totalStars < next.cost.stars ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: totalXP < next.cost.xp || totalStars < next.cost.stars ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      )}
                      {!next && (
                        <p style={{ textAlign: 'center', fontSize: '14px', marginTop: '10px', color: '#888' }}>
                          Nivel Máximo
                        </p>
                      )}
                </div>
                  );
                })()}

                {/* Cannon - Progressive upgrade */}
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
                      {next && (
                        <>
                          <p style={{ textAlign: 'center', fontSize: '13px', marginTop: '10px' }}>{next.desc}</p>
                          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginTop: '10px' }}>
                            {next.cost.xp} XP + {next.cost.stars}⭐
                          </p>
                  <button 
                            onClick={() => buyItem(next.item)}
                            disabled={totalXP < next.cost.xp || totalStars < next.cost.stars}
                    style={{
                      background: 'transparent',
                      border: '2px solid #ffff00',
                      color: '#ffff00',
                              padding: '10px 20px',
                              fontSize: '16px',
                              cursor: totalXP < next.cost.xp || totalStars < next.cost.stars ? 'not-allowed' : 'pointer',
                      borderRadius: '5px',
                              opacity: totalXP < next.cost.xp || totalStars < next.cost.stars ? 0.5 : 1,
                      width: '100%',
                              marginTop: '10px'
                    }}
                  >
                            COMPRAR NIVEL {next.level}
                  </button>
                        </>
                      )}
                      {!next && (
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