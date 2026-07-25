import { useState, type CSSProperties, type FormEvent } from 'react';
import { saveToken, signUp, logIn } from '../lib/api';

type Mode = 'signin' | 'signup';

interface AuthScreenProps {
  onSignedIn: () => void;
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '12px',
  border: '1px solid #E2DACB',
  padding: '0 16px',
  fontSize: '14px',
  color: '#211C16',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session =
        mode === 'signin' ? await logIn(username, password) : await signUp(username, password, confirmPassword);
      saveToken(session.access_token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === 'signin' ? 'Sign in' : 'Sign up'} failed`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F7F3EC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <main style={{ width: '100%', maxWidth: '448px' }}>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
            padding: '48px 40px',
            textAlign: 'center',
            border: '1px solid rgba(226,218,203,0.5)',
          }}
        >
          <div style={{ marginBottom: '32px' }}>
            <img
              src="/logo.png"
              alt="Tamreena"
              style={{ width: '72px', height: '72px', borderRadius: '16px', marginBottom: '16px' }}
            />
            <h1
              style={{
                fontFamily: 'Newsreader, serif',
                fontWeight: 500,
                fontSize: '36px',
                color: '#B5502E',
                letterSpacing: '-0.01em',
                marginBottom: '12px',
              }}
            >
              Tamreena
            </h1>
            <p
              style={{
                color: '#5B5347',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.05em',
                opacity: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Your body. Your data. Your protocol.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              id="username-input"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              required
            />
            <input
              id="password-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
              minLength={8}
            />
            {mode === 'signup' && (
              <input
                id="confirm-password-input"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                required
                minLength={8}
              />
            )}

            <button
              id="submit-btn"
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                height: '52px',
                backgroundColor: '#B5502E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                cursor: submitting ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>

            {error && (
              <p style={{ fontSize: '12px', color: '#A83A2E', margin: 0 }}>{error}</p>
            )}
          </form>

          <button
            id="toggle-mode-btn"
            type="button"
            onClick={toggleMode}
            style={{
              marginTop: '24px',
              fontSize: '12px',
              color: '#8C6F52',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </main>
    </div>
  );
}

export default AuthScreen;
