import { useState } from 'react';
import { useTranslation } from '../i18n.jsx';

export default function AuthScreen({ onLogin, hasExistingAccount = false }) {
  // Si hay cuenta existente en este navegador, mostrar login por defecto
  // Si no, mostrar registro por defecto
  const [isLogin, setIsLogin] = useState(hasExistingAccount);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t, lang, setLang } = useTranslation();

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
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => setLang('es')}
          style={{
            padding: '6px 12px',
            background: lang === 'es' ? 'rgba(51, 255, 255, 0.3)' : 'transparent',
            border: '1px solid #33ffff',
            borderRadius: '4px',
            color: '#33ffff',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ES
        </button>
        <button
          type="button"
          onClick={() => setLang('en')}
          style={{
            padding: '6px 12px',
            background: lang === 'en' ? 'rgba(51, 255, 255, 0.3)' : 'transparent',
            border: '1px solid #33ffff',
            borderRadius: '4px',
            color: '#33ffff',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          EN
        </button>
      </div>
      <h1 style={{
        fontSize: '48px',
        marginBottom: '40px',
        textShadow: '0 0 20px #33ffff',
        letterSpacing: '4px'
      }}>
        {t('auth.title')}
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
          {isLogin ? t('auth.login_title') : t('auth.register_title')}
        </h2>

        {!isLogin && (
          <p style={{
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#aaa',
            lineHeight: '1.5'
          }}>
            {t('auth.welcome')}
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
              {t('auth.field.username')} <span style={{ color: '#ff3366' }}>*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder={t('auth.field.username_placeholder')}
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
                {t('auth.field.email')} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '12px' }}>(opcional)</span>
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
                📧 {t('auth.field.email_optional_note')}
              </p>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#33ffff'
            }}>
                {t('auth.field.password')} <span style={{ color: '#ff3366' }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={t('auth.field.password_placeholder')}
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
            {loading
              ? t('auth.submit.loading')
              : (isLogin ? t('auth.submit.login') : t('auth.submit.register'))}
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
            {isLogin ? t('auth.toggle.to_register') : t('auth.toggle.to_login')}
          </button>
        </div>
      </div>
    </div>
  );
}
