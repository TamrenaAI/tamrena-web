import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getLiveSessionWebSocketUrl,
  saveLiveSessionResult,
  uploadLiveSessionVideo,
  type CvExercise,
} from '../../lib/api';

interface LiveSessionLocationState {
  exercise: CvExercise;
}

interface LiveState {
  reps: number;
  good: number;
  bad: number;
  feedback: string[];
}

type Phase = 'upload' | 'live' | 'complete' | 'error';

const INITIAL_LIVE_STATE: LiveState = { reps: 0, good: 0, bad: 0, feedback: [] };

function LiveSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LiveSessionLocationState | null;

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveState>(INITIAL_LIVE_STATE);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ reps: number; good: number; bad: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const liveStateRef = useRef<LiveState>(INITIAL_LIVE_STATE);
  const phaseRef = useRef<Phase>('upload');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    };
  }, []);

  if (!state) {
    navigate('/exercises', { replace: true });
    return null;
  }

  const { exercise } = state;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const finishSession = async (reps: number, good: number, bad: number) => {
    try {
      await saveLiveSessionResult(exercise.id, exercise.name, reps, good, bad);
    } catch (err) {
      console.error('Failed to save live session result', err);
    }
    setResult({ reps, good, bad });
    setPhase('complete');
  };

  const startLiveSession = (videoId: string) => {
    const ws = new WebSocket(getLiveSessionWebSocketUrl(exercise.id, videoId));
    wsRef.current = ws;
    ws.binaryType = 'blob';

    ws.onopen = () => {
      setUploading(false);
      setPhase('live');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          const next: LiveState = { reps: data.reps, good: data.good, bad: data.bad, feedback: data.feedback ?? [] };
          liveStateRef.current = next;
          setLiveState(next);
        } else if (data.type === 'end') {
          wsRef.current = null;
          ws.close();
          const current = liveStateRef.current;
          finishSession(data.reps ?? current.reps, current.good, current.bad);
        } else if (data.type === 'error') {
          wsRef.current = null;
          setError(data.message);
          setPhase('error');
          ws.close();
        }
      } else {
        const blobUrl = URL.createObjectURL(event.data as Blob);
        if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = blobUrl;
        setFrameUrl(blobUrl);
      }
    };

    ws.onerror = () => {
      wsRef.current = null;
      setError('Lost connection during the live session.');
      setPhase('error');
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (phaseRef.current === 'live' && !event.wasClean) {
        setError('Lost connection during the live session.');
        setPhase('error');
      }
    };
  };

  const handleStartAnalysis = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const upload = await uploadLiveSessionVideo(file);
      startLiveSession(upload.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setUploading(false);
    }
  };

  const handleEndSession = () => {
    wsRef.current?.send(JSON.stringify({ action: 'stop' }));
  };

  const handleRetry = () => {
    setError(null);
    setPhase('upload');
    setFile(null);
    setLiveState(INITIAL_LIVE_STATE);
    liveStateRef.current = INITIAL_LIVE_STATE;
    if (frameUrlRef.current) {
      URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = null;
    }
    setFrameUrl(null);
    setResult(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-dark)',
        padding: '48px 24px',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: '580px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span className="badge badge-emerald" style={{ marginBottom: '10px' }}>CV Computer Vision HUD</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Live Session — {exercise.name}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Real-time pose tracking, rep counting & posture biomechanics
          </p>
        </div>

        {phase === 'upload' && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
              📹
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
              Select Video File for Form Analysis
            </h3>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', marginBottom: '24px' }}>
              Upload your execution video to launch real-time websocket AI telemetry.
            </p>

            <input id="live-session-file-input" type="file" accept="video/*" onChange={handleFileChange} className="form-input" style={{ marginBottom: '16px' }} />
            
            {error && <p style={{ color: '#fda4af', fontSize: '13px', marginBottom: '16px' }}>⚠️ {error}</p>}
            
            <button
              id="live-session-start-btn"
              onClick={handleStartAnalysis}
              disabled={!file || uploading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
            >
              {uploading ? 'Analyzing Telemetry...' : 'Start CV Form Analysis'}
            </button>
          </div>
        )}

        {phase === 'live' && (
          <div className="glass-panel" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.9)' }}>
            {frameUrl ? (
              <img
                id="live-session-frame"
                src={frameUrl}
                alt="Live camera view"
                style={{ width: '100%', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: 'var(--shadow-emerald)' }}
              />
            ) : (
              <div style={{ width: '100%', height: '280px', background: '#070a11', borderRadius: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }} className="shimmer">
                Initializing AI Neural Stream...
              </div>
            )}

            {/* Rep Counter HUD Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>TOTAL REPS</span>
                <p id="live-session-reps" className="metric-val" style={{ fontSize: '24px', color: '#f8fafc', margin: '2px 0 0 0' }}>{liveState.reps}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PERFECT FORM</span>
                <p id="live-session-good" className="metric-val" style={{ fontSize: '24px', color: '#34d399', margin: '2px 0 0 0' }}>{liveState.good}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>FORM BREAK</span>
                <p id="live-session-bad" className="metric-val" style={{ fontSize: '24px', color: '#f43f5e', margin: '2px 0 0 0' }}>{liveState.bad}</p>
              </div>
            </div>

            {liveState.feedback.length > 0 && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>LIVE BIOMECHANICS FEEDBACK</span>
                {liveState.feedback.map((message, i) => (
                  <p key={i} style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0 }}>✓ {message}</p>
                ))}
              </div>
            )}

            <button id="live-session-end-btn" onClick={handleEndSession} className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}>
              End Live Session
            </button>
          </div>
        )}

        {phase === 'complete' && result && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
              🎯
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '16px' }}>
              Session Analysis Complete
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL REPS</span>
                <p id="live-session-final-reps" className="metric-val" style={{ fontSize: '22px', color: '#f8fafc', margin: '2px 0 0 0' }}>{result.reps}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>GOOD REPS</span>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', margin: '2px 0 0 0' }}>{result.good}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>BAD REPS</span>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#f43f5e', margin: '2px 0 0 0' }}>{result.bad}</p>
              </div>
            </div>

            <a href="/exercises" id="live-session-back-link" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Return to Exercise Directory →
            </a>
          </div>
        )}

        {phase === 'error' && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <p style={{ color: '#fda4af', fontSize: '14px', marginBottom: '20px' }}>⚠️ {error}</p>
            <button id="live-session-retry-btn" onClick={handleRetry} className="btn btn-primary">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveSession;
