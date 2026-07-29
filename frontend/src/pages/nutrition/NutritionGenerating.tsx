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

  const [statusText, setStatusText] = useState('Initializing AI pipeline…');
  const [currentNode, setCurrentNode] = useState<string>('profile');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/nutrition/intake', { replace: true });
      return;
    }

    const eventSource = new EventSource(getNutritionStreamUrl(state.run_id));
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.node) {
        setCurrentNode(data.node);
      }
      if (data.node === 'workflow' && data.status === 'completed') {
        eventSource.close();
        eventSourceRef.current = null;
        navigate(`/nutrition/results/${encodeURIComponent(state.run_id)}`, { replace: true });
      } else if (data.node === 'workflow' && data.status === 'failed') {
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

  // Each entry's `nodes` lists every graph node name (see Nutrition-Plan-Generation's
  // stream_service.py NODE_PROGRESS map) that should light up this UI step — the
  // dataset and llm_arabic pipelines use different node names for meal composition.
  const steps = [
    { id: 'profile', label: 'User Biometrics & Goals', nodes: ['profile'] },
    { id: 'calories', label: 'BMR & Caloric Target Calculation', nodes: ['calories'] },
    { id: 'macros', label: 'Macronutrient Split (Protein/Carbs/Fat)', nodes: ['macros'] },
    {
      id: 'meal_composition',
      label: 'Meal Dataset Matching & Composition',
      nodes: ['meal_distributor', 'retrieve_foods', 'compose_meal', 'compose_meals_iterative', 'increment_retry'],
    },
    { id: 'validation', label: 'Nutrition Rules Validation', nodes: ['validate'] },
    { id: 'explanation', label: 'AI Rationale & Guidelines', nodes: ['explain'] },
  ];

  if (error) {
    return (
      <div className="glass-panel" style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
          ⚠️
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
          Generation Issue
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>{error}</p>
        <button
          id="nutrition-generating-retry-btn"
          onClick={() => navigate('/nutrition/intake')}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '580px', margin: '40px auto' }}>
      <div className="glass-panel" style={{ padding: '40px', background: 'rgba(15, 23, 42, 0.85)', textAlign: 'center', boxShadow: 'var(--shadow-cyan)' }}>
        {/* Animated Loading Spinner */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '4px solid rgba(255, 255, 255, 0.08)',
            borderTopColor: '#06b6d4',
            margin: '0 auto 24px',
          }}
          className="animate-spin-slow"
        />

        <span className="badge badge-cyan" style={{ marginBottom: '12px' }}>AI Dataset Synthesizer</span>

        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0' }}>
          Formulating Nutrition Protocol
        </h1>
        <p id="nutrition-generating-status" style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '28px' }}>
          {statusText}
        </p>

        {/* Pipeline Step Progress */}
        <div style={{ textAlign: 'left', background: 'rgba(7, 10, 17, 0.6)', borderRadius: '14px', padding: '18px 20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {steps.map((step, i) => {
            const isCurrent = step.nodes.includes(currentNode);
            return (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? '#10b981' : 'rgba(148, 163, 184, 0.3)',
                    boxShadow: isCurrent ? '0 0 10px #10b981' : 'none',
                  }}
                />
                <span style={{ fontSize: '13.5px', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#34d399' : '#64748b' }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default NutritionGenerating;
