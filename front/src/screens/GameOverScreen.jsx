import React from 'react';
import { useTranslation } from '../i18n.jsx';

/**
 * Pantalla de Game Over
 */
const GameOverScreen = ({ 
  level, 
  totalXP, 
  onBackToMenu,
  gameRef,
  saveUserProgress 
}) => {
  const { t } = useTranslation();
  const handleBackToMenu = () => {
    // Save progress before returning to menu
    saveUserProgress();
    
    // Reset game state
    if (gameRef?.current) {
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
    }
    
    onBackToMenu();
  };

  return (
    <div style={{ 
      textAlign: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      padding: '40px',
      borderRadius: '10px',
      border: '2px solid #ff3366',
      boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)'
    }}>
      <h2 style={{ color: '#ff3366', textShadow: '0 0 20px #ff3366' }}>
        {t('gameover.title')}
      </h2>
      <p style={{ fontSize: '20px' }}>{t('gameover.level_reached')} {level}</p>
      <p style={{ fontSize: '20px' }}>{t('gameover.total_xp')} {totalXP}</p>
      <button 
        onClick={handleBackToMenu}
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
        {t('common.back_to_menu')}
      </button>
    </div>
  );
};

export default GameOverScreen;
