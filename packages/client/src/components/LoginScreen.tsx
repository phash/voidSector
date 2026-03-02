import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const setAuth = useStore((s) => s.setAuth);
  const setScreen = useStore((s) => s.setScreen);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unknown error');
        return;
      }
      setAuth(data.token, data.player.id, data.player.username);
      await network.joinSector(0, 0);
      setScreen('game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '16px',
      position: 'relative',
      zIndex: 1,
    }}>
      <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.3em', marginBottom: '32px' }}>
        VOID SECTOR
      </h1>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '300px',
      }}>
        <input
          type="text"
          placeholder="USERNAME"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
          minLength={3}
          maxLength={32}
          required
        />
        <input
          type="password"
          placeholder="PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          minLength={6}
          required
        />
        {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>{error}</div>}
        <button type="submit" disabled={loading} className="vs-btn">
          {loading ? 'CONNECTING...' : isRegister ? 'REGISTER' : 'LOGIN'}
        </button>
        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="vs-btn"
          style={{ opacity: 0.6, border: 'none' }}
        >
          {isRegister ? 'HAVE ACCOUNT? LOGIN' : 'NEW PILOT? REGISTER'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  padding: '10px 12px',
  fontSize: '0.9rem',
  letterSpacing: '0.1em',
  outline: 'none',
};
