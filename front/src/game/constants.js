// Constantes del juego compartidas entre modos

export const SNAKE_SIZE = 8;
export const FOOD_SIZE = 6;
export const BORDER_WIDTH = 20;

// Función para calcular BASE_UNIT basado en dimensiones del canvas
export const getBaseUnit = (canvasWidth, canvasHeight) => {
  return Math.max(canvasWidth, canvasHeight);
};

// Función para calcular tamaño del mundo basado en mapSize
export const getWorldSize = (mapSize, baseUnit) => {
  return baseUnit * mapSize;
};
