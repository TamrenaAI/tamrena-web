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
  // onmessage is assigned once per WebSocket, so it closes over stale
  // React state; this ref always holds the latest tallies for the "end"
  // event handler to read.
  const liveStateRef = useRef<LiveState>(INITIAL_LIVE_STATE);
  // ws.onclose/onmessage are assigned once per WebSocket and close over
  // the phase value at connection time; this ref always holds the
  // CURRENT phase so onclose can tell an unexpected drop during a live
  // session apart from a normal close after 'end'/'error'.
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
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F3EC', padding: '48px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
          Live Session — {exercise.name}
        </h1>

        {phase === 'upload' && (
          <>
            <input id="live-session-file-input" type="file" accept="video/*" onChange={handleFileChange} />
            {error && <p style={{ color: '#A83A2E', fontSize: '13px' }}>{error}</p>}
            <button
              id="live-session-start-btn"
              onClick={handleStartAnalysis}
              disabled={!file || uploading}
              style={{ marginTop: '16px', display: 'block' }}
            >
              {uploading ? 'Starting…' : 'Start Analysis'}
            </button>
          </>
        )}

        {phase === 'live' && (
          <>
            {frameUrl ? (
              <img
                id="live-session-frame"
                src={frameUrl}
                alt="Live camera view"
                style={{ width: '100%', borderRadius: '12px', marginBottom: '16px' }}
              />
            ) : (
              <div style={{ width: '100%', height: '240px', backgroundColor: '#F2E2CC', borderRadius: '12px', marginBottom: '16px' }} />
            )}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <p id="live-session-reps">Reps: {liveState.reps}</p>
              <p id="live-session-good">Good: {liveState.good}</p>
              <p id="live-session-bad">Bad: {liveState.bad}</p>
            </div>
            {liveState.feedback.length > 0 && (
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2DACB', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                {liveState.feedback.map((message, i) => (
                  <p key={i} style={{ fontSize: '13px', color: '#5B5347', margin: 0 }}>{message}</p>
                ))}
              </div>
            )}
            <button id="live-session-end-btn" onClick={handleEndSession}>End Session</button>
          </>
        )}

        {phase === 'complete' && result && (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2DACB', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontFamily: 'Newsreader, serif', fontSize: '20px', color: '#211C16', marginBottom: '12px' }}>
              Session Complete
            </h2>
            <p id="live-session-final-reps" style={{ fontSize: '14px', color: '#5B5347' }}>Reps: {result.reps}</p>
            <p style={{ fontSize: '14px', color: '#5B5347' }}>Good: {result.good}</p>
            <p style={{ fontSize: '14px', color: '#5B5347', marginBottom: '16px' }}>Bad: {result.bad}</p>
            <a href="/exercises" id="live-session-back-link" style={{ color: '#B5502E', fontSize: '14px', fontWeight: 600 }}>
              Back to Exercises →
            </a>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <p style={{ color: '#A83A2E', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
            <button id="live-session-retry-btn" onClick={handleRetry}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveSession;
