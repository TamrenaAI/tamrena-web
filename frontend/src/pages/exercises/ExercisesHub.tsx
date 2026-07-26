import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCvExercises, getTamreenaExercises, mediaUrl, type CvExercise, type TamreenaExerciseListItem } from '../../lib/api';

type Mode = 'all' | 'cv';

function ExercisesHub() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
  };

  const filteredTamreena = tamreenaItems?.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.target_muscle && item.target_muscle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCv = cvItems?.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.muscle_groups.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span className="badge badge-emerald">3D & Computer Vision Catalog</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time Biomechanics</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
          Exercise Directory & Live AI Form Coach
        </h1>
      </div>

      {/* Controls Bar: Mode Filter + Search Input */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Mode Switcher */}
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '4px' }}>
          <button
            id="exercises-mode-all"
            type="button"
            onClick={() => handleModeChange('all')}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: mode === 'all' ? '#10b981' : 'transparent',
              color: mode === 'all' ? '#042f2e' : '#94a3b8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All Exercises ({tamreenaItems?.length ?? '...'})
          </button>
          <button
            id="exercises-mode-cv"
            type="button"
            onClick={() => handleModeChange('cv')}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: mode === 'cv' ? '#10b981' : 'transparent',
              color: mode === 'cv' ? '#042f2e' : '#94a3b8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📹</span>
            <span>CV AI Trackable</span>
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '300px' }}>
          <input
            type="text"
            placeholder="Search movement or muscle group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '38px', height: '42px', fontSize: '13px' }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px' }}>
            🔍
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ALL EXERCISES GRID */}
      {mode === 'all' && tamreenaItems === null && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading exercise catalog…</div>
      )}
      {mode === 'all' && filteredTamreena && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {filteredTamreena.map((item) => (
            <div
              key={item.name}
              onClick={() => openTamreenaDetail(item)}
              className="glass-card-interactive"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                {item.gif_url ? (
                  <div style={{ width: '100%', height: '150px', overflow: 'hidden', borderRadius: '12px', marginBottom: '14px', backgroundColor: '#070a11' }}>
                    <img
                      src={mediaUrl(item.gif_url) ?? undefined}
                      alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '150px',
                      background: 'rgba(30, 41, 59, 0.6)',
                      borderRadius: '12px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10b981',
                      fontSize: '32px',
                    }}
                  >
                    🏋️
                  </div>
                )}

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0', lineHeight: 1.3 }}>
                  {item.name}
                </h3>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {item.target_muscle ? (
                  <span className="badge badge-emerald" style={{ padding: '2px 8px', fontSize: '10px' }}>
                    {item.target_muscle}
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>General</span>
                )}
                <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>Detail →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CV TRACKABLE EXERCISES GRID */}
      {mode === 'cv' && cvItems === null && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading computer vision models…</div>
      )}
      {mode === 'cv' && filteredCv && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {filteredCv.map((item) => (
            <div
              id={`cv-exercise-card-${item.id}`}
              key={item.id}
              onClick={() => openCvDetail(item)}
              className="glass-card-interactive"
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <div
                  style={{
                    width: '100%',
                    height: '140px',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    marginBottom: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '32px' }}>📹</span>
                  <span className="badge badge-emerald" style={{ padding: '2px 8px', fontSize: '10px' }}>
                    CV MODEL LOADED
                  </span>
                </div>

                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                  {item.muscle_groups.join(', ')}
                </p>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                <span>{item.rules} Biomechanical Rules</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>Launch HUD →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExercisesHub;
