import { useState } from 'react';

export default function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
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
      : { username, email, password };

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
          // Si falla el parseo JSON, leer como texto
          const text = await response.text();
          throw new Error(text || `Error ${response.status}: ${response.statusText}`);
        }
      } else {
        // Si no es JSON, leer como texto
        const text = await response.text();
        throw new Error(text || `Error ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }

      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Error en la autenticación');
      console.error('Login error:', err);
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
          {isLogin ? 'INICIAR SESIÓN' : 'REGISTRARSE'}
        </h2>

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
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(51, 255, 255, 0.1)',
                border: '1px solid #33ffff',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '16px'
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
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(51, 255, 255, 0.1)',
                  border: '1px solid #33ffff',
                  borderRadius: '5px',
                  color: '#fff',
                  fontSize: '16px'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#33ffff'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(51, 255, 255, 0.1)',
                border: '1px solid #33ffff',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '16px'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: 'transparent',
              border: '2px solid #33ffff',
              borderRadius: '5px',
              color: '#33ffff',
              fontSize: '18px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textShadow: '0 0 10px #33ffff',
              boxShadow: '0 0 20px rgba(51, 255, 255, 0.5)',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'CARGANDO...' : (isLogin ? 'ENTRAR' : 'CREAR CUENTA')}
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
            {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
