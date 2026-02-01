import React from 'react';

/**
 * Pantalla de Victoria al completar los 25 niveles
 */
const VictoryScreen = ({ 
  victoryData,
  rebirthCount,
  isMobile,
  onRebirth,
  onBackToMenu
}) => {
  if (!victoryData) return null;

  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: isMobile ? '20px' : '40px',
      gap: '30px',
      zIndex: 10000,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div style={{ 
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 0, 255, 0.2))',
        padding: isMobile ? '30px' : '60px',
        borderRadius: '20px',
        border: '3px solid #FFD700',
        boxShadow: '0 0 50px rgba(255, 215, 0, 0.8), inset 0 0 30px rgba(255, 215, 0, 0.3)',
        width: '100%',
        maxWidth: '800px'
      }}>
        <div style={{ fontSize: isMobile ? '60px' : '80px', marginBottom: '20px' }}>🎉🏆🎉</div>
        <h1 style={{ 
          color: '#FFD700', 
          textShadow: '0 0 30px #FFD700, 0 0 50px #ff00ff',
          fontSize: isMobile ? '32px' : '48px',
          marginBottom: '20px',
          fontWeight: 'bold',
          letterSpacing: '2px'
        }}>
          ¡FELICITACIONES!
        </h1>
        <h2 style={{ 
          color: '#00ff88', 
          textShadow: '0 0 20px #00ff88',
          fontSize: isMobile ? '24px' : '32px',
          marginBottom: '20px'
        }}>
          ¡Completaste los 25 niveles!
        </h2>
        
        <div style={{ 
          fontSize: isMobile ? '16px' : '20px', 
          color: '#ff00ff', 
          marginBottom: '30px',
          textShadow: '0 0 10px #ff00ff'
        }}>
          ⚡ Serie {victoryData.series} Completada ⚡
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          padding: isMobile ? '20px' : '30px',
          borderRadius: '15px',
          marginBottom: '30px',
          border: '2px solid #33ffff'
        }}>
          <div style={{ fontSize: isMobile ? '18px' : '24px', color: '#888', marginBottom: '10px' }}>
            Tu Puntuación Final
          </div>
          <div style={{ 
            fontSize: isMobile ? '36px' : '56px', 
            color: '#33ffff', 
            fontWeight: 'bold',
            textShadow: '0 0 20px #33ffff',
            marginBottom: '20px'
          }}>
            {victoryData.score.toLocaleString()} XP
          </div>
          
          {victoryData.isNewRecord ? (
            <div style={{
              fontSize: isMobile ? '20px' : '28px',
              color: '#FFD700',
              textShadow: '0 0 20px #FFD700',
              fontWeight: 'bold',
              marginTop: '15px'
            }}>
              ✨ ¡NUEVO RÉCORD PERSONAL! ✨
            </div>
          ) : (
            <div style={{ fontSize: isMobile ? '14px' : '18px', color: '#888', marginTop: '10px' }}>
              Tu récord anterior: {victoryData.previousBestScore.toLocaleString()} XP
            </div>
          )}
        </div>
        
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          padding: isMobile ? '20px' : '25px',
          borderRadius: '15px',
          border: '2px solid #FFD700'
        }}>
          <div style={{ fontSize: isMobile ? '18px' : '24px', color: '#888', marginBottom: '10px' }}>
            Ranking Mundial
          </div>
          <div style={{ 
            fontSize: isMobile ? '36px' : '48px', 
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
        
        <div style={{
          background: 'rgba(255, 0, 0, 0.2)',
          padding: isMobile ? '20px' : '25px',
          borderRadius: '15px',
          marginTop: '30px',
          border: '2px solid #ff3366',
          boxShadow: '0 0 20px rgba(255, 51, 102, 0.4)'
        }}>
          <h3 style={{ 
            color: '#ff3366', 
            fontSize: isMobile ? '20px' : '24px',
            marginBottom: '15px',
            textShadow: '0 0 15px #ff3366'
          }}>
            ¿Querés mejorar tu marca?
          </h3>
          <p style={{ 
            color: '#fff', 
            fontSize: isMobile ? '14px' : '16px',
            marginBottom: '10px',
            lineHeight: '1.6'
          }}>
            Hacé <strong>Rebirth</strong> para volver a nivel 1
          </p>
          <p style={{ 
            color: '#00ff88', 
            fontSize: isMobile ? '14px' : '18px',
            fontWeight: 'bold',
            textShadow: '0 0 10px #00ff88'
          }}>
            ✨ Ventaja: Todos los upgrades empiezan en nivel {rebirthCount + 1} ✨
          </p>
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          justifyContent: 'center',
          marginTop: '40px',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={onRebirth}
            style={{
              background: 'transparent',
              border: '3px solid #ff3366',
              color: '#ff3366',
              padding: isMobile ? '15px 30px' : '20px 40px',
              fontSize: isMobile ? '18px' : '24px',
              cursor: 'pointer',
              borderRadius: '10px',
              textShadow: '0 0 10px #ff3366',
              boxShadow: '0 0 30px rgba(255, 51, 102, 0.5)',
              transition: 'all 0.3s',
              fontWeight: 'bold'
            }}
          >
            ♻️ REBIRTH
          </button>
          
          <button 
            onClick={onBackToMenu}
            style={{
              background: 'transparent',
              border: '3px solid #FFD700',
              color: '#FFD700',
              padding: isMobile ? '15px 30px' : '20px 50px',
              fontSize: isMobile ? '18px' : '24px',
              cursor: 'pointer',
              borderRadius: '10px',
              textShadow: '0 0 10px #FFD700',
              boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
              transition: 'all 0.3s',
              fontWeight: 'bold'
            }}
          >
            VOLVER AL MENÚ
          </button>
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen;
