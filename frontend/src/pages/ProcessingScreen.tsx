import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generatePlan, getGeneratePlanStreamUrl, type IntakeAnswers } from '../lib/api';

interface ProcessingLocationState {
  intake: IntakeAnswers;
  inbodyFile: File;
}

function ProcessingScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ProcessingLocationState | null;

  const [statusText, setStatusText] = useState('Starting…');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/intake', { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    generatePlan(state.intake, state.inbodyFile)
      .then(({ session_id }) => {
        setStatusText('Generating your plan…');
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
            setStatusText(data.label ? `${data.agent}: ${data.label}` : 'Working…');
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
          backgroundColor: '#F7F3EC',
          padding: '48px',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#A83A2E', marginBottom: '16px' }}>{error}</p>
        <button id="processing-retry-btn" onClick={() => navigate('/intake')}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F7F3EC',
        padding: '48px',
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
        Generating Your Plan
      </h1>
      <p id="processing-status" style={{ color: '#5B5347', fontSize: '14px' }}>
        {statusText}
      </p>
    </div>
  );
}

export default ProcessingScreen;
