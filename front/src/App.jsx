import { useState, useEffect } from 'react';
import SnakeGame from './SnakeGame';
import AuthScreen from './components/AuthScreen';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [freeShots, setFreeShots] = useState(false);
  const [isImmune, setIsImmune] = useState(false);
  const [gameMode, setGameMode] = useState(null); // null = selector, 'single' = single player, 'arena' = arena

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    if (token && userId) {
      // Verify token with API
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then(data => {
        console.log('User data from /api/auth/me:', data);
        setUser(data);
        setIsAdmin(data.isAdmin === true || data.isAdmin === 'true');
        setIsBanned(data.isBanned === true || data.isBanned === 'true');
        setFreeShots(data.freeShots === true || data.freeShots === 'true');
        setIsImmune(data.isImmune === true || data.isImmune === 'true');
        console.log('isAdmin set to:', data.isAdmin === true || data.isAdmin === 'true');
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token, adminStatus = false, bannedStatus = false, freeShotsStatus = false, isImmuneStatus = false) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userData.id);
    localStorage.setItem('viborita_registered', 'true'); // Marcar que este navegador tiene cuenta
    setUser(userData);
    setIsAdmin(adminStatus);
    setIsBanned(bannedStatus);
    setFreeShots(freeShotsStatus);
    setIsImmune(isImmuneStatus);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setUser(null);
    setIsAdmin(false);
    setIsBanned(false);
    setFreeShots(false);
    setIsImmune(false);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#33ffff',
        fontSize: '24px',
        fontFamily: 'monospace'
      }}>
        Cargando...
      </div>
    );
  }

  if (!user) {
    // Si hay token en localStorage, es un usuario que ya se registró antes
    const hasExistingAccount = localStorage.getItem('viborita_registered') === 'true';
    return <AuthScreen onLogin={handleLogin} hasExistingAccount={hasExistingAccount} />;
  }

  // Selector de modo de juego
  if (gameMode === null) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        color: '#33ffff',
        fontFamily: 'monospace'
      }}>
        <h1 style={{ fontSize: '36px', marginBottom: '40px' }}>VIBORITA</h1>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => setGameMode('single')}
            style={{
              padding: '20px 40px',
              fontSize: '20px',
              background: '#33ffff',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              minWidth: '200px'
            }}
          >
            MODO CAMPAÑA
          </button>
          <button
            onClick={() => setGameMode('arena')}
            style={{
              padding: '20px 40px',
              fontSize: '20px',
              background: '#ff3366',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              minWidth: '200px'
            }}
          >
            ARENA MULTIJUGADOR
          </button>
        </div>
        <button
          onClick={handleLogout}
          style={{
            marginTop: '40px',
            padding: '10px 20px',
            fontSize: '14px',
            background: 'transparent',
            color: '#33ffff',
            border: '1px solid #33ffff',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  // Renderizar el modo de juego seleccionado
  return (
    <SnakeGame 
      user={user} 
      onLogout={() => setGameMode(null)} 
      isAdmin={isAdmin} 
      isBanned={isBanned} 
      freeShots={freeShots} 
      isImmune={isImmune}
      arenaMode={gameMode === 'arena'}
    />
  );
}

export default App;
