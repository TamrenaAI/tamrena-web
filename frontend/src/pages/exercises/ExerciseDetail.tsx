import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getTamreenaExerciseDetail,
  mediaUrl,
  type CvExercise,
  type TamreenaExerciseDetail,
  type TamreenaExerciseListItem,
} from '../../lib/api';

type DetailLocationState =
  | { source: 'tamreena'; item: TamreenaExerciseListItem }
  | { source: 'cv'; item: CvExercise };

function ExerciseDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as DetailLocationState | null;

  const [tamreenaDetail, setTamreenaDetail] = useState<TamreenaExerciseDetail | null>(null);

  useEffect(() => {
    if (state?.source === 'tamreena') {
      getTamreenaExerciseDetail(state.item.name)
        .then(setTamreenaDetail)
        .catch((err) => {
          // Non-fatal: name, gif, target muscle, and equipment are already known
          // from router state. Losing the supplemental instructions fetch (e.g. a
          // fuzzy-match 404) should not blank the rest of the page.
          console.error('Failed to load exercise detail', err);
        });
    }
  }, [state]);

  if (!state) {
    navigate('/exercises', { replace: true });
    return null;
  }

  const { source, item } = state;

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16', marginBottom: '16px' }}>
        {item.name}
      </h1>

      {source === 'tamreena' && (
        <>
          {item.gif_url && (
            <img
              src={mediaUrl(item.gif_url) ?? undefined}
              alt={item.name}
              style={{ maxWidth: '320px', borderRadius: '12px', marginBottom: '16px' }}
            />
          )}
          {item.target_muscle && <p style={{ fontSize: '14px', color: '#5B5347' }}>Target muscle: {item.target_muscle}</p>}
          {item.equipment && <p style={{ fontSize: '14px', color: '#5B5347' }}>Equipment: {item.equipment}</p>}
          {tamreenaDetail?.instructions && (
            <p style={{ fontSize: '14px', color: '#5B5347', whiteSpace: 'pre-wrap', marginTop: '12px' }}>
              {tamreenaDetail.instructions}
            </p>
          )}
        </>
      )}

      {source === 'cv' && (
        <>
          <p style={{ fontSize: '14px', color: '#5B5347', marginBottom: '8px' }}>{item.description}</p>
          <p style={{ fontSize: '14px', color: '#5B5347', marginBottom: '16px' }}>
            Muscles: {item.muscle_groups.join(', ')}
          </p>

          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2DACB', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontFamily: 'Newsreader, serif', fontSize: '20px', color: '#211C16', marginBottom: '12px' }}>
              Live Tracking
            </h2>
            <p style={{ fontSize: '13px', color: '#5B5347' }}>Camera angle: {item.camera}</p>
            <p style={{ fontSize: '13px', color: '#5B5347', marginBottom: '16px' }}>
              {item.rules} form {item.rules === 1 ? 'rule' : 'rules'} checked live
            </p>
            <button
              id="start-live-session-btn"
              onClick={() => navigate('/exercises/live-session', { state: { exercise: item } })}
            >
              Start Live Session
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ExerciseDetail;
