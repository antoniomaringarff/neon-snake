// Funciones de lógica del juego compartidas

/**
 * Verifica colisión entre dos posiciones
 */
export const checkCollision = (pos1, pos2, distance) => {
  if (!distance) distance = 8 * 2; // Default snake size * 2
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy) < distance;
};

/**
 * Crea partículas de efecto visual
 */
export const createParticle = (x, y, color, count = 8, particlesArray) => {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    particlesArray.push({
      x, y,
      vx: Math.cos(angle) * (2 + Math.random() * 2),
      vy: Math.sin(angle) * (2 + Math.random() * 2),
      life: 1,
      color
    });
  }
};

/**
 * Normaliza un vector 2D
 */
export const normalizeVector = (x, y) => {
  const length = Math.sqrt(x * x + y * y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
};

/**
 * Calcula distancia entre dos puntos
 */
export const getDistance = (pos1, pos2) => {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calcula ángulo entre dos puntos
 */
export const getAngle = (pos1, pos2) => {
  return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
};
