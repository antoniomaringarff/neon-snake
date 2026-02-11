import React from 'react';
import { useTranslation } from '../../i18n.jsx';

/**
 * Componente reutilizable para mostrar tablas de ranking
 */
const LeaderboardTable = ({ 
  title, 
  icon, 
  data, 
  columns, 
  color = '#FFD700',
  currentUsername,
  isMobile = false,
  maxItems = 3
}) => {
  // Limitar la cantidad de items mostrados
  const displayData = data.slice(0, maxItems);
  const { t } = useTranslation();
  return (
    <div style={{ 
      background: 'rgba(0, 0, 0, 0.7)',
      padding: isMobile ? '6px' : '8px',
      borderRadius: '8px',
      border: `2px solid ${color}`,
      boxShadow: `0 0 30px ${color}33`,
      flex: '1 1 220px',
      minWidth: 0,
      width: isMobile ? '100%' : 'auto',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <h2 style={{ 
        color: color, 
        textShadow: `0 0 20px ${color}`, 
        textAlign: 'center',
        marginBottom: isMobile ? '4px' : '6px',
        fontSize: isMobile ? '10px' : '11px'
      }}>
        {icon} {title}
      </h2>
      <div style={{ maxHeight: isMobile ? '90px' : '100px', overflowY: 'auto' }}>
        {displayData.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', fontSize: isMobile ? '10px' : '12px' }}>
            {t('leaderboard.loading')}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${color}` }}>
                <th style={{ 
                  padding: isMobile ? '4px' : '6px', 
                  textAlign: 'left', 
                  color: color, 
                  fontSize: isMobile ? '9px' : '11px' 
                }}>
                  #
                </th>
                {columns.map((col, idx) => (
                  <th 
                    key={idx}
                    style={{ 
                      padding: isMobile ? '4px' : '6px', 
                      textAlign: col.align || 'left', 
                      color: col.headerColor || color, 
                      fontSize: isMobile ? '9px' : '11px' 
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((entry, index) => {
                const isCurrentUser = entry.username === currentUsername;
                return (
                  <tr 
                    key={entry.username || index}
                    style={{ 
                      borderBottom: `1px solid ${color}22`,
                      backgroundColor: isCurrentUser ? `${color}11` : 'transparent'
                    }}
                  >
                    <td style={{ 
                      padding: isMobile ? '4px' : '6px', 
                      color: index < 3 ? color : '#33ffff', 
                      fontSize: isMobile ? '10px' : '12px' 
                    }}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    {columns.map((col, colIdx) => (
                      <td 
                        key={colIdx}
                        style={{ 
                          padding: isMobile ? '4px' : '6px', 
                          textAlign: col.align || 'left',
                          color: isCurrentUser ? color : (col.valueColor || '#fff'),
                          fontWeight: isCurrentUser ? 'bold' : 'normal',
                          fontSize: isMobile ? '10px' : '12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {col.render ? col.render(entry) : entry[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LeaderboardTable;
