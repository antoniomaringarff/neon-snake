import { useState } from 'react';

export default function AuthScreen({ onLogin, hasExistingAccount = false }) {
  // Si hay cuenta existente en este navegador, mostrar login por defecto
  // Si no, mostrar registro por defecto
  const [isLogin, setIsLogin] = useState(hasExistingAccount);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin 
      ? { username, password }
      : { username, email: email || undefined, password }; // Email opcional

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          const text = await response.text();
          throw new Error(text || `Error ${response.status}: ${response.statusText}`);
        }
      } else {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        if (data.isBanned) {
          const bannedUntil = data.bannedUntil ? new Date(data.bannedUntil) : null;
          const minutesLeft = bannedUntil ? Math.ceil((bannedUntil - new Date()) / 1000 / 60) : null;
          throw new Error(bannedUntil ? `Tu cuenta está suspendida por ${minutesLeft} minutos más` : 'Tu cuenta ha sido suspendida. Por favor contacta al administrador.');
        }
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }

      onLogin(data.user, data.token, data.isAdmin || false, data.isBanned || false, data.bannedUntil || null, data.freeShots || false, data.isImmune || false);
    } catch (err) {
      setError(err.message || 'Error en la autenticación');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
      color: '#33ffff',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <h1 style={{
        fontSize: '48px',
        marginBottom: '40px',
        textShadow: '0 0 20px #33ffff',
        letterSpacing: '4px'
      }}>
        NEON SNAKE
      </h1>

      <div style={{
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '40px',
        borderRadius: '10px',
        border: '2px solid #33ffff',
        boxShadow: '0 0 30px rgba(51, 255, 255, 0.3)',
        minWidth: '400px'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '30px',
          fontSize: '24px'
        }}>
          {isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
        </h2>

        {!isLogin && (
          <p style={{
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#aaa',
            lineHeight: '1.5'
          }}>
            ¡Bienvenido! Crea tu cuenta para empezar a jugar.
          </p>
        )}

        {error && (
          <div style={{
            background: 'rgba(255, 51, 102, 0.2)',
            border: '1px solid #ff3366',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '20px',
            color: '#ff3366'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#33ffff'
            }}>
              Usuario <span style={{ color: '#ff3366' }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Elegí tu nombre de usuario"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(51, 255, 255, 0.1)',
                border: '1px solid #33ffff',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#33ffff'
              }}>
                Email <span style={{ color: '#888', fontWeight: 'normal', fontSize: '12px' }}>(opcional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Solo para recuperar tu cuenta"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(51, 255, 255, 0.1)',
                  border: '1px solid #555',
                  borderRadius: '5px',
                  color: '#fff',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '11px',
                color: '#666',
                fontStyle: 'italic'
              }}>
                📧 Si perdés acceso a tu cuenta, el email te permite recuperarla.
              </p>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#33ffff'
            }}>
              Contraseña <span style={{ color: '#ff3366' }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(51, 255, 255, 0.1)',
                border: '1px solid #33ffff',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: isLogin ? 'transparent' : 'rgba(51, 255, 255, 0.2)',
              border: '2px solid #33ffff',
              borderRadius: '5px',
              color: '#33ffff',
              fontSize: '18px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textShadow: '0 0 10px #33ffff',
              boxShadow: '0 0 20px rgba(51, 255, 255, 0.5)',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? 'CARGANDO...' : (isLogin ? 'ENTRAR' : '¡CREAR CUENTA Y JUGAR!')}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff00ff',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            {isLogin ? '¿Primera vez? Creá tu cuenta' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
