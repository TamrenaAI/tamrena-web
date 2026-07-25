import { useEffect, useState } from 'react';
import { saveToken, signInWithGoogle, devLogin } from '../lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

interface SignInProps {
  onSignedIn: () => void;
}

function SignIn({ onSignedIn }: SignInProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.google || !GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          const session = await signInWithGoogle(response.credential);
          saveToken(session.access_token);
          onSignedIn();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Sign-in failed');
        }
      },
    });
  }, [onSignedIn]);

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured on this deployment.');
      return;
    }
    if (!window.google) {
      setError('Google Sign-In script not loaded.');
      return;
    }
    window.google.accounts.id.prompt();
  };

  // Dev-login bypass — only shown/usable when the backend has it enabled;
  // a disabled backend just returns 404 and this button becomes a no-op
  // error, same fail-safe behavior as Tamreena_AI's own former dev-login.
  const handleDevLoginClick = async () => {
    try {
      const session = await devLogin();
      saveToken(session.access_token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dev login failed');
    }
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <button
              id="google-signin-btn"
              onClick={handleGoogleClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                width: '100%',
                height: '52px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2DACB',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#211C16',
              }}
            >
              Sign in with Google
            </button>

            <p style={{ fontSize: '11px', color: '#8C6F52', lineHeight: 1.6, maxWidth: '240px', margin: '0 auto' }}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>

            {import.meta.env.DEV && (
              <button
                id="dev-login-btn"
                onClick={handleDevLoginClick}
                style={{
                  fontSize: '12px',
                  color: '#8C6F52',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Dev login (test only)
              </button>
            )}

            {error && <p style={{ fontSize: '12px', color: '#A83A2E' }}>{error}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

export default SignIn;
