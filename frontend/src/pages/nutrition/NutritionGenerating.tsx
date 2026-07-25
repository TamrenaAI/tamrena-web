import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNutritionStreamUrl } from '../../lib/api';

interface NutritionGeneratingLocationState {
  run_id: string;
}

function NutritionGenerating() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as NutritionGeneratingLocationState | null;

  const [statusText, setStatusText] = useState('Starting…');
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/nutrition/intake', { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const eventSource = new EventSource(getNutritionStreamUrl(state.run_id));
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'completed') {
        eventSource.close();
        eventSourceRef.current = null;
        navigate(`/nutrition/results/${state.run_id}`, { replace: true });
      } else if (data.status === 'failed') {
        eventSource.close();
        eventSourceRef.current = null;
        setError(data.reason || data.message || 'Nutrition plan generation failed.');
      } else {
        setStatusText(data.message || `${data.node}: ${data.status}`);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setError('Lost connection while generating your nutrition plan.');
    };

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [state, navigate]);

  if (error) {
    return (
      <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#A83A2E', marginBottom: '16px' }}>{error}</p>
        <button id="nutrition-generating-retry-btn" onClick={() => navigate('/nutrition/intake')}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
        Generating Your Nutrition Plan
      </h1>
      <p id="nutrition-generating-status" style={{ color: '#5B5347', fontSize: '14px' }}>
        {statusText}
      </p>
    </div>
  );
}

export default NutritionGenerating;
