import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSessions, type WorkoutSession } from '../lib/api';

function Home() {
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'));
  }, []);

  if (error) {
    return (
      <div
        style={{
          padding: '20px',
          borderRadius: '14px',
          backgroundColor: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fda4af',
          fontSize: '14px',
        }}
      >
        ⚠️ {error}
      </div>
    );
  }

  if (sessions === null) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <div className="shimmer" style={{ width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 20px' }} />
        <p style={{ fontWeight: 600 }}>Connecting to Tamreena-AI Neural Core...</p>
      </div>
    );
  }

  const hasPlan = sessions.length > 0;
  const latest = sessions[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Hero Welcome Command Card */}
      <div
        className="glass-panel"
        style={{
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: 'var(--shadow-emerald)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span className="badge badge-emerald">AI Fitness Engine Active</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Updated Today</span>
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              {hasPlan ? `Protocol: ${latest.goal ?? 'Hypertrophy & Strength'}` : 'Welcome to Tamreena-AI Studio'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '15px', marginTop: '8px', lineHeight: 1.6 }}>
              {hasPlan
                ? `Your active training routine is synced. Status: ${latest.status.toUpperCase()}. Track exercises, monitor InBody muscle symmetry, or adjust your dataset nutrition plan.`
                : 'Build your custom AI workout & nutrition protocol based on OCR InBody scanning and biomechanical targets.'}
            </p>

            <div style={{ display: 'flex', gap: '14px', marginTop: '24px', flexWrap: 'wrap' }}>
              <Link
                id={hasPlan ? 'latest-session-link' : 'generate-first-plan-link'}
                to={hasPlan ? `/workout/${latest.session_id}` : '/intake'}
                className="btn btn-primary"
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                <span>{hasPlan ? 'Open Active Workout Routine' : 'Generate First AI Plan'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
              </Link>

              <Link to="/nutrition" className="btn btn-cyan" style={{ padding: '14px 24px', fontSize: '15px' }}>
                <span>Build Nutrition Plan</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}>
            <div className="glass-panel" style={{ padding: '14px 18px', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total AI Sessions</span>
              <div className="metric-val" style={{ fontSize: '24px', color: '#34d399', marginTop: '2px' }}>
                {sessions.length} <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>Plans Built</span>
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '14px 18px', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overload Index</span>
              <div className="metric-val" style={{ fontSize: '24px', color: '#38bdf8', marginTop: '2px' }}>
                98.4% <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Action Cards Grid */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981' }}>✦</span> AI Training Command Modules
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Card 1: AI Workout Plan */}
          <Link to="/workout" style={{ textDecoration: 'none' }}>
            <div className="glass-card-interactive" style={{ padding: '24px', height: '100%' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>AI Workout Studio</h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                Personalized progressive volume, exercise selections, and adaptive set/rep targets.
              </p>
              <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View Routines →
              </div>
            </div>
          </Link>

          {/* Card 2: Nutrition & Macros */}
          <Link to="/nutrition" style={{ textDecoration: 'none' }}>
            <div className="glass-card-interactive" style={{ padding: '24px', height: '100%' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Dataset Nutrition Engine</h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                BMR & TDEE macro targets with curated meal recipes for breakfast, lunch, dinner & snacks.
              </p>
              <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Generate Meal Plan →
              </div>
            </div>
          </Link>

          {/* Card 3: InBody & Progress */}
          <Link to="/progress" style={{ textDecoration: 'none' }}>
            <div className="glass-card-interactive" style={{ padding: '24px', height: '100%' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>InBody & Asymmetry Scan</h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                Track Skeletal Muscle Mass (SMM), body fat %, and detect arm/leg muscular imbalances.
              </p>
              <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Analyze Diagnostics →
              </div>
            </div>
          </Link>

          {/* Card 4: Exercises & CV Coach */}
          <Link to="/exercises" style={{ textDecoration: 'none' }}>
            <div className="glass-card-interactive" style={{ padding: '24px', height: '100%' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect></svg>
              </div>
              <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Computer Vision Form Coach</h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
                Real-time webcam pose detection, posture analysis, rep counting, and biomechanical feedback.
              </p>
              <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Launch CV Studio →
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
