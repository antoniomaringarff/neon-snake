import React from 'react';

/**
 * Componente de chat reutilizable
 */
const ChatBox = ({ 
  messages, 
  inputValue, 
  onInputChange, 
  onSend, 
  user,
  isMobile = false,
  id = 'chat-messages'
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = user && inputValue.trim();

  return (
    <div style={{ 
      marginTop: isMobile ? '8px' : '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: isMobile ? '6px' : '10px',
      borderRadius: '8px',
      border: '2px solid #33ffff',
      boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
      width: '100%'
    }}>
      <h2 style={{ 
        color: '#33ffff', 
        textShadow: '0 0 20px #33ffff', 
        textAlign: 'center',
        marginBottom: isMobile ? '4px' : '6px',
        fontSize: isMobile ? '11px' : '12px'
      }}>
        💬 CHAT
      </h2>
      
      {/* Messages container */}
      <div 
        id={id}
        style={{ 
          maxHeight: isMobile ? '80px' : '100px',
          overflowY: 'auto',
          marginBottom: '10px',
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '5px',
          border: '1px solid rgba(51, 255, 255, 0.2)'
        }}
      >
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', fontSize: '12px' }}>
            No hay mensajes aún. ¡Sé el primero en escribir!
          </p>
        ) : (
          messages.map((msg) => (
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
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
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
          onClick={onSend}
          disabled={!canSend}
          style={{
            padding: '10px 20px',
            background: canSend ? 'transparent' : 'rgba(51, 255, 255, 0.2)',
            border: '2px solid #33ffff',
            borderRadius: '5px',
            color: canSend ? '#33ffff' : '#888',
            fontSize: '12px',
            cursor: canSend ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            if (canSend) {
              e.target.style.background = 'rgba(51, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (canSend) {
              e.target.style.background = 'transparent';
            }
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default ChatBox;
