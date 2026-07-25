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
    return <p style={{ color: '#A83A2E' }}>{error}</p>;
  }
  if (sessions === null) {
    return <p>Loading…</p>;
  }

  if (sessions.length === 0) {
    return (
      <div>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16' }}>Welcome to Tamreena</h1>
        <p style={{ color: '#5B5347', fontSize: '14px', marginBottom: '16px' }}>
          Generate your first personalised workout plan to get started.
        </p>
        <Link
          id="generate-first-plan-link"
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
          Generate Your First Plan
        </Link>
      </div>
    );
  }

  const latest = sessions[0];
  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16' }}>Welcome back</h1>
      <p style={{ color: '#5B5347', fontSize: '14px', marginBottom: '16px' }}>
        Latest plan: {latest.goal ?? 'Untitled goal'} — {latest.status}
      </p>
      <Link
        id="latest-session-link"
        to={`/workout/${latest.session_id}`}
        style={{ color: '#B5502E', fontSize: '14px', fontWeight: 600 }}
      >
        View your plan →
      </Link>
    </div>
  );
}

export default Home;
