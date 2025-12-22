import { useState, useEffect } from 'react';
import SnakeGame from './SnakeGame';
import AuthScreen from './components/AuthScreen';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

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
        setUser(data);
        setIsAdmin(data.isAdmin || false);
        setIsBanned(data.isBanned || false);
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

  const handleLogin = (userData, token, adminStatus = false, bannedStatus = false) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userData.id);
    setUser(userData);
    setIsAdmin(adminStatus);
    setIsBanned(bannedStatus);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setUser(null);
    setIsAdmin(false);
    setIsBanned(false);
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
    return <AuthScreen onLogin={handleLogin} />;
  }

  return <SnakeGame user={user} onLogout={handleLogout} isAdmin={isAdmin} isBanned={isBanned} />;
}

export default App;
