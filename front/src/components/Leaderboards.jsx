import React from 'react';
import LeaderboardTable from './ui/LeaderboardTable';
import { useTranslation } from '../i18n.jsx';

/**
 * Componente que muestra todos los rankings del juego
 */
const Leaderboards = ({ 
  leaderboard,
  leaderboardByLevel,
  leaderboardByRebirth,
  leaderboardByTotalXP,
  leaderboardByTotalStars,
  leaderboardBySeries,
  currentUsername,
  isMobile = false 
}) => {
  const { t } = useTranslation();
  // Combinar datos de rebirth y nivel
  const getCombinedData = () => {
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
    
    // Convertir a array y ordenar
    const combinedData = Array.from(userMap.values());
    combinedData.sort((a, b) => {
      if (b.rebirthCount !== a.rebirthCount) {
        return b.rebirthCount - a.rebirthCount;
      }
      return (b.highestLevel || 1) - (a.highestLevel || 1);
    });
    
    return combinedData;
  };

  const combinedData = getCombinedData();

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '6px' : '8px',
      width: isMobile ? '100%' : 'auto',
      maxWidth: '100%',
      flex: isMobile ? 'none' : '1',
      overflow: 'hidden'
    }}>
      {/* Primera fila: XP y Rebirth & Nivel */}
      <div style={{ 
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '6px' : '10px',
        width: '100%',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        alignItems: 'stretch'
      }}>
        {/* Ranking por XP */}
        <LeaderboardTable
          title={t('leaderboard.xp_title')}
          icon="🏆"
          color="#FFD700"
          data={leaderboard}
          currentUsername={currentUsername}
          isMobile={isMobile}
          columns={[
            { header: t('leaderboard.username'), key: 'username' },
            { 
              header: t('leaderboard.xp'), 
              align: 'right',
              valueColor: '#33ffff',
              render: (entry) => entry.totalXp?.toLocaleString() || 0
            }
          ]}
        />

        {/* Ranking combinado: Rebirth, Nivel y Niveles Totales */}
        <div style={{ 
          background: 'rgba(0, 0, 0, 0.7)',
          padding: isMobile ? '6px' : '8px',
          borderRadius: '8px',
          border: '2px solid #33ffff',
          boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
          flex: '1 1 260px',
          minWidth: 0,
          width: isMobile ? '100%' : 'auto',
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <h2 style={{ 
            color: '#33ffff', 
            textShadow: '0 0 20px #33ffff', 
            textAlign: 'center',
            marginBottom: isMobile ? '4px' : '6px',
            fontSize: isMobile ? '10px' : '11px'
          }}>
            {t('leaderboard.rebirth_and_level_title')}
          </h2>
          <div style={{ maxHeight: isMobile ? '90px' : '100px', overflowY: 'auto' }}>
            {combinedData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#888', fontSize: isMobile ? '10px' : '12px' }}>
                {t('leaderboard.loading')}
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #33ffff' }}>
                    <th style={{ padding: isMobile ? '4px' : '6px', textAlign: 'left', color: '#33ffff', fontSize: isMobile ? '9px' : '11px' }}>#</th>
                    <th style={{ padding: isMobile ? '4px' : '6px', textAlign: 'left', color: '#33ffff', fontSize: isMobile ? '9px' : '11px' }}>
                      {t('leaderboard.username')}
                    </th>
                    <th style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#ff3366', fontSize: isMobile ? '9px' : '11px' }}>
                      {t('leaderboard.rebirth')}
                    </th>
                    <th style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#33ffff', fontSize: isMobile ? '9px' : '11px' }}>
                      {t('leaderboard.level')}
                    </th>
                    <th style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#FFD700', fontSize: isMobile ? '9px' : '11px' }}>
                      {t('leaderboard.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {combinedData.slice(0, 3).map((entry, index) => {
                    const isCurrentUser = entry.username === currentUsername;
                    return (
                      <tr 
                        key={entry.username}
                        style={{ 
                          borderBottom: '1px solid rgba(51, 255, 255, 0.2)',
                          backgroundColor: isCurrentUser ? 'rgba(51, 255, 255, 0.1)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: isMobile ? '4px' : '6px', color: index < 3 ? '#33ffff' : '#FFD700', fontSize: isMobile ? '10px' : '12px' }}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </td>
                        <td style={{ padding: isMobile ? '4px' : '6px', color: isCurrentUser ? '#33ffff' : '#fff', fontWeight: isCurrentUser ? 'bold' : 'normal', fontSize: isMobile ? '10px' : '12px' }}>
                          {entry.username}
                        </td>
                        <td style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#ff3366', fontSize: isMobile ? '10px' : '12px' }}>
                          {entry.rebirthCount || 0}
                        </td>
                        <td style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#33ffff', fontSize: isMobile ? '10px' : '12px' }}>
                          {entry.highestLevel || 1}
                        </td>
                        <td style={{ padding: isMobile ? '4px' : '6px', textAlign: 'right', color: '#FFD700', fontSize: isMobile ? '10px' : '12px' }}>
                          {entry.totalSessions || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Segunda fila: XP Total, Estrellas, Serie */}
      <div style={{ 
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '6px' : '10px',
        width: '100%',
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        alignItems: 'stretch'
      }}>
        {/* XP Total */}
        <LeaderboardTable
          title={t('leaderboard.total_xp_title')}
          icon="💎"
          color="#00ff88"
          data={leaderboardByTotalXP}
          currentUsername={currentUsername}
          isMobile={isMobile}
          columns={[
            { header: t('leaderboard.username'), key: 'username' },
            { 
              header: t('leaderboard.xp'), 
              align: 'right',
              valueColor: '#33ffff',
              render: (entry) => entry.totalXp?.toLocaleString() || 0
            }
          ]}
        />

        {/* Estrellas Totales */}
        <LeaderboardTable
          title={t('leaderboard.total_stars_title')}
          icon="⭐"
          color="#FFD700"
          data={leaderboardByTotalStars}
          currentUsername={currentUsername}
          isMobile={isMobile}
          columns={[
            { header: t('leaderboard.username'), key: 'username' },
            { 
              header: t('leaderboard.stars'), 
              align: 'right',
              valueColor: '#ffff00',
              render: (entry) => entry.totalStars?.toLocaleString() || 0
            }
          ]}
        />

        {/* Serie */}
        <LeaderboardTable
          title={t('leaderboard.series_title')}
          icon="🔢"
          color="#ff00ff"
          data={leaderboardBySeries}
          currentUsername={currentUsername}
          isMobile={isMobile}
          columns={[
            { header: t('leaderboard.username'), key: 'username' },
            { 
              header: t('leaderboard.series'), 
              align: 'right',
              valueColor: '#ff88ff',
              render: (entry) => entry.currentSeries || 1
            }
          ]}
        />
      </div>
    </div>
  );
};

export default Leaderboards;
