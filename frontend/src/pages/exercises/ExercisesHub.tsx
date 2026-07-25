import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCvExercises, getTamreenaExercises, mediaUrl, type CvExercise, type TamreenaExerciseListItem } from '../../lib/api';

type Mode = 'all' | 'cv';

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E2DACB',
  borderRadius: '12px',
  padding: '16px',
  cursor: 'pointer',
  textAlign: 'left' as const,
};

function ExercisesHub() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('all');
  const [tamreenaItems, setTamreenaItems] = useState<TamreenaExerciseListItem[] | null>(null);
  const [cvItems, setCvItems] = useState<CvExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'all' && tamreenaItems === null) {
      getTamreenaExercises()
        .then((res) => setTamreenaItems(res.exercises))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exercises'));
    }
    if (mode === 'cv' && cvItems === null) {
      getCvExercises()
        .then(setCvItems)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load CV exercises'));
    }
  }, [mode, tamreenaItems, cvItems]);

  const openTamreenaDetail = (item: TamreenaExerciseListItem) => {
    navigate('/exercises/detail', { state: { source: 'tamreena', item } });
  };

  const openCvDetail = (item: CvExercise) => {
    navigate('/exercises/detail', { state: { source: 'cv', item } });
  };

  if (error) return <p style={{ color: '#A83A2E' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16', marginBottom: '16px' }}>
        Exercises
      </h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button id="exercises-mode-all" onClick={() => setMode('all')} style={{ fontWeight: mode === 'all' ? 700 : 400 }}>
          All Exercises
        </button>
        <button id="exercises-mode-cv" onClick={() => setMode('cv')} style={{ fontWeight: mode === 'cv' ? 700 : 400 }}>
          CV Trackable
        </button>
      </div>

      {mode === 'all' && tamreenaItems === null && <p>Loading…</p>}
      {mode === 'all' && tamreenaItems && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {tamreenaItems.map((item) => (
            <button key={item.name} onClick={() => openTamreenaDetail(item)} style={cardStyle}>
              {item.gif_url ? (
                <img
                  src={mediaUrl(item.gif_url) ?? undefined}
                  alt={item.name}
                  style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '120px',
                    backgroundColor: '#F2E2CC',
                    borderRadius: '8px',
                    marginBottom: '8px',
                  }}
                />
              )}
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#211C16', margin: 0 }}>{item.name}</p>
              {item.target_muscle && (
                <p style={{ fontSize: '12px', color: '#5B5347', margin: 0 }}>{item.target_muscle}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {mode === 'cv' && cvItems === null && <p>Loading…</p>}
      {mode === 'cv' && cvItems && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {cvItems.map((item) => (
            <button id={`cv-exercise-card-${item.id}`} key={item.id} onClick={() => openCvDetail(item)} style={cardStyle}>
              <div
                style={{
                  width: '100%',
                  height: '120px',
                  backgroundColor: '#F2E2CC',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              />
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#211C16', margin: 0 }}>{item.name}</p>
              <p style={{ fontSize: '12px', color: '#5B5347', margin: 0 }}>{item.muscle_groups.join(', ')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExercisesHub;
