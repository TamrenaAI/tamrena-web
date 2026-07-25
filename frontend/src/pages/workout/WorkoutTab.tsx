import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getSessions, type WorkoutSession } from '../../lib/api';

function WorkoutTab() {
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'));
  }, []);

  if (error) return <p style={{ color: '#A83A2E' }}>{error}</p>;
  if (sessions === null) return <p>Loading…</p>;
  if (sessions.length > 0) return <Navigate to={`/workout/${sessions[0].session_id}`} replace />;

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16' }}>No plan yet</h1>
      <p style={{ color: '#5B5347', fontSize: '14px', marginBottom: '16px' }}>
        Generate a personalised workout plan from your InBody scan and goals.
      </p>
      <Link
        id="start-intake-link"
        to="/intake"
        style={{
          display: 'inline-block',
          backgroundColor: '#B5502E',
          color: '#FFFFFF',
          padding: '12px 24px',
          borderRadius: '12px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Start Intake
      </Link>
    </div>
  );
}

export default WorkoutTab;
