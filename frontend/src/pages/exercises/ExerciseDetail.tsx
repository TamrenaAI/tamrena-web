import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  getTamreenaExerciseDetail,
  mediaUrl,
  type CvExercise,
  type TamreenaExerciseDetail,
  type TamreenaExerciseListItem,
} from '../../lib/api';

type DetailLocationState =
  | { source: 'tamreena'; item: TamreenaExerciseListItem }
  | { source: 'cv'; item: CvExercise };

function ExerciseDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as DetailLocationState | null;

  const [tamreenaDetail, setTamreenaDetail] = useState<TamreenaExerciseDetail | null>(null);

  useEffect(() => {
    if (state?.source === 'tamreena') {
      getTamreenaExerciseDetail(state.item.name)
        .then(setTamreenaDetail)
        .catch((err) => {
          console.error('Failed to load exercise detail', err);
        });
    }
  }, [state]);

  if (!state) {
    navigate('/exercises', { replace: true });
    return null;
  }

  const { source, item } = state;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Navigation Link */}
      <Link
        to="/exercises"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#34d399',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 700,
        }}
      >
        <span>← Back to Exercise Library</span>
      </Link>

      {/* Hero Detail Container Card */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            {item.name}
          </h1>

          {source === 'cv' && (
            <span className="badge badge-emerald">
              ✓ AI FORM TRACKING SUPPORTED
            </span>
          )}
        </div>

        {source === 'tamreena' && (
          <div>
            {item.gif_url && (
              <div style={{ width: '100%', maxWidth: '440px', margin: '0 auto 28px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#070a11', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <img
                  src={mediaUrl(item.gif_url) ?? undefined}
                  alt={item.name}
                  style={{ width: '100%', display: 'block' }}
                />
              </div>
            )}

            {/* Badges Grid */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {item.target_muscle && (
                <div className="glass-panel" style={{ padding: '12px 18px', background: 'rgba(7, 10, 17, 0.6)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', display: 'block', textTransform: 'uppercase' }}>TARGET MUSCLE</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#34d399' }}>{item.target_muscle}</span>
                </div>
              )}
              {item.equipment && (
                <div className="glass-panel" style={{ padding: '12px 18px', background: 'rgba(7, 10, 17, 0.6)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', display: 'block', textTransform: 'uppercase' }}>EQUIPMENT</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8' }}>{item.equipment}</span>
                </div>
              )}
            </div>

            {/* Instructions */}
            {tamreenaDetail?.instructions && (
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '24px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                  BIOMECHANICAL EXECUTION INSTRUCTIONS
                </span>
                <p style={{ fontSize: '14.5px', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
                  {tamreenaDetail.instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {source === 'cv' && (
          <div>
            <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
              {item.description}
            </p>

            <div className="glass-panel" style={{ padding: '14px 20px', display: 'inline-block', marginBottom: '24px', background: 'rgba(7, 10, 17, 0.6)' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', display: 'block', textTransform: 'uppercase' }}>PRIMARY MUSCLE GROUPS</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#34d399' }}>{item.muscle_groups.join(', ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Computer Vision Live Tracking Card */}
      {source === 'cv' && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '20px',
            padding: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: '#34d399', fontSize: '20px' }}>🎥</span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Live AI Form Tracking Studio
            </h2>
          </div>

          <p style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.6 }}>
            Launch a real-time camera tracking session. Tamreena-AI analyzes pose angles and rep velocity using computer vision.
          </p>

          <div style={{ display: 'flex', gap: '24px', fontSize: '13.5px', color: '#cbd5e1', marginBottom: '24px', flexWrap: 'wrap' }}>
            <span>📹 Camera Setup: <strong style={{ color: '#34d399' }}>{item.camera}</strong></span>
            <span>⚡ Form Rules Analyzed: <strong style={{ color: '#38bdf8' }}>{item.rules} rules</strong></span>
          </div>

          <button
            id="start-live-session-btn"
            onClick={() => navigate('/exercises/live-session', { state: { exercise: item } })}
            className="btn btn-primary"
            style={{ padding: '14px 28px', fontSize: '15px' }}
          >
            <span>Launch Live Form Tracking Session</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default ExerciseDetail;
