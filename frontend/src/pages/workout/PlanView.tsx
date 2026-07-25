import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { getSessionPlan, submitFeedback, type ExerciseFeedback, type SessionPlanResponse } from '../../lib/api';

function PlanView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [planData, setPlanData] = useState<SessionPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayLabel, setDayLabel] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [difficulty, setDifficulty] = useState<ExerciseFeedback['difficulty']>('just_right');
  const [pain, setPain] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSessionPlan(sessionId)
      .then(setPlanData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plan'));
  }, [sessionId]);

  const handleFeedbackSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setSubmitting(true);
    setFeedbackResult(null);
    try {
      const result = await submitFeedback(sessionId, dayLabel, [{ name: exerciseName, difficulty, pain }]);
      setFeedbackResult(
        result.adjustment_triggered ? result.summary ?? 'Plan adjusted based on your feedback.' : 'Feedback recorded.',
      );
    } catch (err) {
      setFeedbackResult(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <p style={{ color: '#A83A2E' }}>{error}</p>;
  if (!planData) return <p>Loading…</p>;
  if (planData.status === 'pending') {
    return <p>Your plan is still being generated. Check back shortly.</p>;
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16', marginBottom: '16px' }}>
        Your Plan
      </h1>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          color: '#211C16',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2DACB',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        {planData.plan}
      </pre>

      <h2 style={{ fontFamily: 'Newsreader, serif', fontSize: '20px', color: '#211C16', marginBottom: '12px' }}>
        Log Exercise Feedback
      </h2>
      <form
        onSubmit={handleFeedbackSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}
      >
        <input
          id="feedback-day-label"
          placeholder="Day label (e.g. Day 1 - Push)"
          value={dayLabel}
          onChange={(e) => setDayLabel(e.target.value)}
          required
        />
        <input
          id="feedback-exercise-name"
          placeholder="Exercise name"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          required
        />
        <select
          id="feedback-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as ExerciseFeedback['difficulty'])}
        >
          <option value="too_easy">Too easy</option>
          <option value="just_right">Just right</option>
          <option value="too_hard">Too hard</option>
        </select>
        <label style={{ fontSize: '13px', color: '#5B5347' }}>
          <input id="feedback-pain" type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} /> Painful
        </label>
        <button id="submit-feedback-btn" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </button>
        {feedbackResult && <p style={{ fontSize: '13px', color: '#5B5347' }}>{feedbackResult}</p>}
      </form>
    </div>
  );
}

export default PlanView;
