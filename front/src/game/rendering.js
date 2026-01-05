// Funciones de renderizado compartidas

/**
 * Dibuja una estrella de 5 puntas
 */
export const drawStar = (ctx, x, y, radius, rotation = 0) => {
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

/**
 * Dibuja texto con sombra para mejor legibilidad
 */
export const drawTextWithShadow = (ctx, text, x, y, fontSize = 16, color = '#ffffff') => {
  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
};
