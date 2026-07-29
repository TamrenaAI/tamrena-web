import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getSessionPlan,
  submitFeedback,
  type ExerciseFeedback,
  type ParsedDay,
  type ParsedExercise,
  type SessionPlanResponse,
} from '../../lib/api';

function PlanView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [planData, setPlanData] = useState<SessionPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeDayId, setActiveDayId] = useState<number | null>(null);

  const [dayLabel, setDayLabel] = useState<string>('');
  const [exerciseName, setExerciseName] = useState<string>('');
  const [difficulty, setDifficulty] = useState<ExerciseFeedback['difficulty']>('just_right');
  const [pain, setPain] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPlan = () => {
    if (!sessionId) return;
    getSessionPlan(sessionId)
      .then((data) => {
        setPlanData(data);
        const freshDays = data.days ?? [];
        if (freshDays.length > 0) {
          setActiveDayId((current) => current ?? freshDays[0].day_number);

          // Resync the feedback form's day/exercise selection against the
          // refetched data. This matters most right after a swap-triggered
          // refetch: the previously-selected exercise name may no longer
          // exist under its old day (it was renamed by the AI adjustment),
          // so keep the current selection only if it's still valid —
          // otherwise fall back to the day's first exercise, same pattern
          // used in handleDaySelectChange.
          const resolvedDayLabel = dayLabel || freshDays[0].label;
          const dayForLabel = freshDays.find((d) => d.label === resolvedDayLabel) ?? freshDays[0];
          setDayLabel(resolvedDayLabel);

          const exerciseStillExists =
            !!exerciseName && dayForLabel.exercises.some((ex) => ex.name === exerciseName);
          setExerciseName(exerciseStillExists ? exerciseName : dayForLabel.exercises[0]?.name ?? '');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plan'));
  };

  useEffect(loadPlan, [sessionId]);

  const days: ParsedDay[] = planData?.days ?? [];
  const activeDay = days.find((d) => d.day_number === activeDayId) ?? days[0];
  const selectedDayObject = days.find((d) => d.label === dayLabel) ?? activeDay;

  const handleDaySelectChange = (newDayLabel: string) => {
    setDayLabel(newDayLabel);
    const dayObj = days.find((d) => d.label === newDayLabel);
    if (dayObj && dayObj.exercises.length > 0) {
      setExerciseName(dayObj.exercises[0].name);
    }
  };

  const handleOpenFeedback = (exercise: ParsedExercise) => {
    setExerciseName(exercise.name);
    if (activeDay) setDayLabel(activeDay.label);
    setDifficulty('just_right');
    setPain(false);
    setFeedbackNote('');
    setFeedbackResult(null);

    const el = document.getElementById('exercise-feedback-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFeedbackSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setSubmitting(true);
    setFeedbackResult(null);
    try {
      const result = await submitFeedback(sessionId, dayLabel, [
        { name: exerciseName, difficulty, pain, note: feedbackNote || undefined },
      ]);

      if (result.adjustment_triggered && result.adjustments && result.adjustments.length > 0) {
        const adj = result.adjustments[0];
        setFeedbackResult(
          adj.new_exercise_name
            ? `✨ AI Core Adjusted Routine: Swapped for ${adj.new_exercise_name}! (${adj.reason})`
            : result.summary ?? 'Feedback recorded and the plan was adjusted.',
        );
        // The persisted plan is the source of truth for what changed — refetch
        // instead of hand-patching local state, so the "AI Replaced" badge
        // survives a refresh exactly like a fresh page load would show it.
        loadPlan();
      } else {
        setFeedbackResult(result.summary ?? 'Feedback recorded successfully by AI Core.');
      }
    } catch (err) {
      setFeedbackResult(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!planData || planData.status === 'pending') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading AI Training Protocol...</p>
      </div>
    );
  }

  if (planData.status === 'failed') {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
        ⚠️ Plan generation failed{planData.error ? `: ${planData.error}` : '.'}
      </div>
    );
  }

  if (!activeDay) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>No training days were found in this plan.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge badge-emerald">HYPERTROPHY & STRENGTH PROTOCOL</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Session #{sessionId?.slice(-6)}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            Interactive AI Training Routine Table
          </h1>
        </div>

        <button onClick={() => window.print()} className="btn btn-secondary" style={{ gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>
          Export Plan (PDF)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {days.map((day) => {
          const isActive = day.day_number === activeDay.day_number;
          return (
            <button
              key={day.day_number}
              onClick={() => {
                setActiveDayId(day.day_number);
                setDayLabel(day.label);
                if (day.exercises.length > 0) setExerciseName(day.exercises[0].name);
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: isActive ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                color: isActive ? '#34d399' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none',
              }}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {activeDay.label}
            </h2>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em' }}>
              TARGET FOCUS: {activeDay.target_focus}
            </span>
          </div>

          <span className="badge badge-emerald">
            {activeDay.exercises.length} EXERCISES
          </span>
        </div>

        {activeDay.warmup && (
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              WARM-UP & MOBILITY PROTOCOL:
            </span>
            <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0 }}>
              {activeDay.warmup}
            </p>
          </div>
        )}

        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exercise Name</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Target Muscle</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Volume Split</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Target RPE & Rest</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Log & Adjust</th>
              </tr>
            </thead>
            <tbody>
              {activeDay.exercises.map((ex, idx) => (
                <tr key={`${ex.name}-${idx}`} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent' }}>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
                      {ex.name}
                    </div>
                    {ex.replaced_from && (
                      <span className="badge badge-amber" style={{ padding: '2px 6px', fontSize: '10px', marginTop: '4px' }}>
                        ⚡ AI Replaced (was {ex.replaced_from})
                      </span>
                    )}
                    {ex.adjustment_reason && (
                      <p style={{ fontSize: '11px', color: '#fbbf24', margin: '2px 0 0 0' }}>
                        Reason: {ex.adjustment_reason}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className="badge badge-emerald" style={{ padding: '4px 10px', fontSize: '11px' }}>
                      {ex.muscle_group ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {ex.sets != null && ex.reps ? `${ex.sets} sets × ${ex.reps} reps` : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#cbd5e1' }}>
                    {ex.rpe ? `RPE ${ex.rpe}` : ''}{ex.rpe && ex.rest ? ' · ' : ''}{ex.rest ? `${ex.rest} rest` : ''}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenFeedback(ex)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '12.5px', gap: '6px' }}
                    >
                      <span>✍️ Log Feedback</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details style={{ marginTop: '16px' }}>
          <summary style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            View Full Raw AI Plan Stream Text output
          </summary>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-sans)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: '#94a3b8',
              backgroundColor: 'rgba(7, 10, 17, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '12px',
            }}
          >
            {planData.plan}
          </pre>
        </details>

        <div id="exercise-feedback-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ color: '#34d399' }}>⚡</span>
            <h4 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', color: '#34d399', textTransform: 'uppercase', margin: 0 }}>
              AI Overload & Exercise Swap Studio
            </h4>
          </div>

          <form onSubmit={handleFeedbackSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Training Day</label>
              <select
                id="feedback-day-label"
                value={dayLabel}
                onChange={(e) => handleDaySelectChange(e.target.value)}
                className="form-select"
                required
              >
                {days.map((d) => (
                  <option key={d.day_number} value={d.label} style={{ background: '#0f172a' }}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exercise Name</label>
              <select
                id="feedback-exercise-name"
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                className="form-select"
                required
              >
                {(selectedDayObject?.exercises ?? []).map((ex) => (
                  <option key={ex.name} value={ex.name} style={{ background: '#0f172a' }}>
                    {ex.name}{ex.muscle_group ? ` (${ex.muscle_group})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Difficulty Rating</label>
              <select
                id="feedback-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ExerciseFeedback['difficulty'])}
                className="form-select"
              >
                <option value="too_easy" style={{ background: '#0f172a' }}>Too Easy (RPE 6-7)</option>
                <option value="just_right" style={{ background: '#0f172a' }}>Just Right (RPE 8-9)</option>
                <option value="too_hard" style={{ background: '#0f172a' }}>Too Hard / Failure</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <input
                  id="feedback-pain-checkbox"
                  type="checkbox"
                  checked={pain}
                  onChange={(e) => setPain(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#f43f5e', cursor: 'pointer' }}
                />
                <label htmlFor="feedback-pain-checkbox" style={{ fontSize: '13.5px', fontWeight: 700, color: pain ? '#f43f5e' : '#cbd5e1', cursor: 'pointer' }}>
                  ⚠️ Report Joint Pain / Injury on this Movement (Triggers Automatic AI Replacement)
                </label>
              </div>
              <textarea
                placeholder="Write specific exercise comments or injury notes (e.g. Left shoulder hurt on bench, machine unavailable, felt too heavy)..."
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={2}
                className="form-textarea"
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                id="submit-feedback-btn"
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ padding: '12px 28px', fontSize: '14px' }}
              >
                {submitting ? 'Analyzing & Swapping...' : 'Submit Feedback to AI Core'}
              </button>
            </div>
          </form>

          {feedbackResult && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                color: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? '#fbbf24' : '#34d399',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {feedbackResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanView;
