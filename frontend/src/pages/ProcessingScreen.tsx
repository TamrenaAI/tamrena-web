import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generatePlan, getGeneratePlanStreamUrl, type IntakeAnswers } from '../lib/api';

interface ProcessingLocationState {
  intake: IntakeAnswers;
  inbodyFile?: File;
  file?: File;
}

function ProcessingScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ProcessingLocationState | null;

  const [statusText, setStatusText] = useState('Extracting InBody metrics & generating plan…');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!state || !state.intake) {
      navigate('/intake', { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const uploadFile = state.inbodyFile || state.file || new File(['dummy-scan'], 'inbody_scan.pdf', { type: 'application/pdf' });

    generatePlan(state.intake, uploadFile)
      .then(({ session_id }) => {
        setStatusText('InBody metrics extracted. Synthesizing AI protocol…');
        const eventSource = new EventSource(getGeneratePlanStreamUrl(session_id));
        eventSourceRef.current = eventSource;
        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'done') {
            eventSource.close();
            eventSourceRef.current = null;
            if (data.error) {
              setError(data.error);
            } else {
              navigate(`/workout/${session_id}`, { replace: true });
            }
          } else if (data.type === 'progress') {
            setStatusText(data.label ? `${data.agent}: ${data.label}` : 'Synthesizing AI protocol…');
          }
        };
        eventSource.onerror = () => {
          eventSource.close();
          eventSourceRef.current = null;
          setError('Lost connection while generating your plan.');
        };
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to start plan generation'));

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [state, navigate]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-dark)',
          padding: '48px',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
          <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>⚠️</span>
          <p style={{ color: '#fda4af', fontSize: '15px', marginBottom: '24px', fontWeight: 600 }}>{error}</p>
          <button
            id="processing-retry-btn"
            onClick={() => navigate('/intake')}
            className="btn btn-primary"
          >
            ← Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-dark)',
        padding: '48px',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="glass-panel" style={{ padding: '48px', maxWidth: '540px', width: '100%', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', boxShadow: 'var(--shadow-emerald)' }}>
        {/* Animated Pulse Ring */}
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)' }} className="animate-pulse-glow">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#042f2e" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>

        <span className="badge badge-emerald" style={{ marginBottom: '12px' }}>RAG Neural Pipeline Active</span>

        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginBottom: '12px' }}>
          Synthesizing AI Fitness Protocol
        </h2>
        
        <p id="processing-status" style={{ color: '#94a3b8', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
          {statusText}
        </p>

        {/* Shimmer Bar */}
        <div style={{ marginTop: '28px', height: '6px', borderRadius: '3px', overflow: 'hidden' }} className="shimmer" />
      </div>
    </div>
  );
}

export default ProcessingScreen;
