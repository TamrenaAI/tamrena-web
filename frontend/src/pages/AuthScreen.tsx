import { useState, type FormEvent } from 'react';
import { saveToken, signUp, logIn } from '../lib/api';

type Mode = 'signin' | 'signup';

interface AuthScreenProps {
  onSignedIn: () => void;
}

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
        backgroundColor: 'var(--bg-dark)',
        display: 'flex',
        alignItems: 'stretch',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Left Feature Showcase Banner */}
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(7, 10, 17, 0.95) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Brand Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#042f2e" strokeWidth="2.5">
              <path d="M6.5 6.5h11M6.5 17.5h11M12 2v20"></path>
              <circle cx="12" cy="12" r="3" fill="#042f2e"></circle>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Tamreena<span style={{ color: '#10b981' }}>-AI</span>
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Intelligent Fitness Engine</p>
          </div>
        </div>

        {/* Hero Copy */}
        <div style={{ zIndex: 1, maxWidth: '520px', margin: '40px 0' }}>
          <span className="badge badge-emerald" style={{ marginBottom: '16px' }}>
            ⚡ Next-Gen AI Workout Engine
          </span>
          <h1 style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.15, color: '#f8fafc', marginBottom: '20px' }}>
            Elevate your training with <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Precision</span>.
          </h1>
          <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '32px' }}>
            Generate hyper-personalized strength splits, analyze InBody scan asymmetry, balance your daily macros, and receive real-time Computer Vision form feedback.
          </p>

          {/* Feature Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ color: '#10b981', marginBottom: '6px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Dataset Nutrition
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Custom macro targets aligned with your TDEE & goal</p>
            </div>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ color: '#06b6d4', marginBottom: '6px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                InBody Scanner
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>OCR muscle mass & limb asymmetry diagnostics</p>
            </div>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ color: '#f59e0b', marginBottom: '6px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                CV Live Coach
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Real-time rep counting & biomechanics feedback</p>
            </div>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ color: '#8b5cf6', marginBottom: '6px', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path></svg>
                AI Overload
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Automatic workout plan adjustments based on feedback</p>
            </div>
          </div>
        </div>

        {/* Footer Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Trusted by elite athletes & gym-goers worldwide</span>
        </div>
      </div>

      {/* Right Auth Card Form */}
      <div
        style={{
          width: '520px',
          minWidth: '460px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="glass-panel" style={{ width: '100%', padding: '40px', background: 'rgba(15, 23, 42, 0.8)' }}>
          {/* Header */}
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
              {mode === 'signin' ? 'Welcome back, Athlete' : 'Create your Account'}
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              {mode === 'signin' ? 'Enter your credentials to access your AI plan' : 'Sign up to build your custom workout & nutrition split'}
            </p>
          </div>

          {/* Tab Mode Selector */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '24px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'signin' ? '#10b981' : 'transparent',
                color: mode === 'signin' ? '#042f2e' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'signup' ? '#10b981' : 'transparent',
                color: mode === 'signup' ? '#042f2e' : '#94a3b8',
                transition: 'all 0.2s ease',
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="username-input">Username</label>
              <input
                id="username-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="password-input">Password</label>
              <input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
                minLength={8}
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="confirm-password-input">Confirm Password</label>
                <input
                  id="confirm-password-input"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  required
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '10px',
                  padding: '12px',
                  color: '#fda4af',
                  fontSize: '13px',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              id="submit-btn"
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', height: '48px', fontSize: '15px', marginTop: '8px' }}
            >
              {submitting ? 'Authenticating...' : mode === 'signin' ? 'Sign In to Dashboard' : 'Create Pro Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              id="toggle-mode-btn"
              type="button"
              onClick={toggleMode}
              style={{
                fontSize: '13px',
                color: '#34d399',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {mode === 'signin' ? "Don't have an account? Sign up now" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
