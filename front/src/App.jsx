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

  return <SnakeGame user={user} onLogout={handleLogout} isAdmin={isAdmin} isBanned={isBanned} freeShots={freeShots} isImmune={isImmune} />;
}

export default App;
