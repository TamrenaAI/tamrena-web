import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getSessionPlan,
  submitFeedback,
  type ExerciseAdjustment,
  type ExerciseFeedback,
  type SessionPlanResponse,
} from '../../lib/api';

interface ExerciseItem {
  id: string;
  name: string;
  muscle: string;
  setsReps: string;
  rpeRest: string;
  replacedFrom?: string;
  adjustmentReason?: string;
}

interface RoutineDay {
  dayId: string;
  label: string;
  targetFocus: string;
  warmup: string;
  exercises: ExerciseItem[];
}

const DEFAULT_DAYS: RoutineDay[] = [
  {
    dayId: 'day1',
    label: 'Day 1 - Push Focus',
    targetFocus: 'CHEST, TRICEPS & FRONT DELTS',
    warmup: '5-10 mins light cardio, 2 sets of 15 face pulls, dynamic shoulder circles.',
    exercises: [
      { id: 'e1', name: 'Incline Dumbbell Press', muscle: 'Upper Chest', setsReps: '4 sets × 8-10 reps', rpeRest: 'RPE 8 · 90s rest' },
      { id: 'e2', name: 'Flat Barbell Bench Press', muscle: 'Mid Chest', setsReps: '3 sets × 6-8 reps', rpeRest: 'RPE 8.5 · 120s rest' },
      { id: 'e3', name: 'Standing Overhead Press', muscle: 'Front Delts', setsReps: '3 sets × 8-10 reps', rpeRest: 'RPE 8 · 90s rest' },
      { id: 'e4', name: 'Cable Lateral Raises', muscle: 'Side Delts', setsReps: '4 sets × 12-15 reps', rpeRest: 'RPE 9 · 60s rest' },
      { id: 'e5', name: 'Tricep Rope Pushdowns', muscle: 'Triceps', setsReps: '3 sets × 10-12 reps', rpeRest: 'RPE 8.5 · 60s rest' },
    ],
  },
  {
    dayId: 'day2',
    label: 'Day 2 - Pull Focus',
    targetFocus: 'BACK, BICEPS & REAR DELTS',
    warmup: '5 mins rower, scapular pull-ups, lat band warm-ups.',
    exercises: [
      { id: 'e6', name: 'Lat Pulldowns (Wide Grip)', muscle: 'Lats & Upper Back', setsReps: '4 sets × 8-10 reps', rpeRest: 'RPE 8 · 90s rest' },
      { id: 'e7', name: 'Chest-Supported Row', muscle: 'Mid-Back & Rhomboids', setsReps: '3 sets × 8-10 reps', rpeRest: 'RPE 8 · 90s rest' },
      { id: 'e8', name: 'Reverse Pec Deck Flyes', muscle: 'Rear Delts', setsReps: '4 sets × 12-15 reps', rpeRest: 'RPE 9 · 60s rest' },
      { id: 'e9', name: 'Incline Dumbbell Bicep Curls', muscle: 'Biceps Long Head', setsReps: '3 sets × 10-12 reps', rpeRest: 'RPE 8 · 60s rest' },
    ],
  },
  {
    dayId: 'day3',
    label: 'Day 3 - Leg Focus',
    targetFocus: 'QUADS, HAMSTRINGS & GLUTES',
    warmup: '5 mins stationary bike, leg swings, hip opening stretch.',
    exercises: [
      { id: 'e10', name: 'Barbell Back Squats', muscle: 'Quads & Glutes', setsReps: '4 sets × 6-8 reps', rpeRest: 'RPE 8.5 · 150s rest' },
      { id: 'e11', name: 'Romanian Deadlifts (RDL)', muscle: 'Hamstrings & Glutes', setsReps: '3 sets × 8-10 reps', rpeRest: 'RPE 8 · 120s rest' },
      { id: 'e12', name: 'Leg Press (Wide Stance)', muscle: 'Quads & Adductors', setsReps: '3 sets × 10-12 reps', rpeRest: 'RPE 8 · 90s rest' },
      { id: 'e13', name: 'Seated Calf Raises', muscle: 'Calves', setsReps: '4 sets × 15 reps', rpeRest: 'RPE 9 · 45s rest' },
    ],
  },
  {
    dayId: 'day4',
    label: 'Day 4 - Core & Stability',
    targetFocus: 'ABS, LOWER BACK & CORE',
    warmup: 'Cat-cow stretches, bird-dogs, plank holds.',
    exercises: [
      { id: 'e14', name: 'Hanging Leg Raises', muscle: 'Abdominals', setsReps: '3 sets × 12-15 reps', rpeRest: 'RPE 8.5 · 60s rest' },
      { id: 'e15', name: 'Ab Wheel Rollouts', muscle: 'Core Stability', setsReps: '3 sets × 10 reps', rpeRest: 'RPE 8 · 60s rest' },
      { id: 'e16', name: 'Cable Woodchoppers', muscle: 'Obliques', setsReps: '3 sets × 12 reps', rpeRest: 'RPE 8 · 60s rest' },
    ],
  },
];

function PlanView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [planData, setPlanData] = useState<SessionPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Interactive Days & Exercises State
  const [routineDays, setRoutineDays] = useState<RoutineDay[]>(DEFAULT_DAYS);
  const [activeDayId, setActiveDayId] = useState<string>('day1');

  // Feedback State with Dropdown Selections
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [dayLabel, setDayLabel] = useState<string>('Day 1 - Push Focus');
  const [exerciseName, setExerciseName] = useState<string>('Incline Dumbbell Press');
  const [difficulty, setDifficulty] = useState<ExerciseFeedback['difficulty']>('just_right');
  const [pain, setPain] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getSessionPlan(sessionId)
      .then(setPlanData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plan'));
  }, [sessionId]);

  const activeDay = routineDays.find((d) => d.dayId === activeDayId) || routineDays[0];

  // Helper to sync exercise options when day selection changes
  const selectedDayObject = routineDays.find((d) => d.label === dayLabel) || activeDay;

  const handleDaySelectChange = (newDayLabel: string) => {
    setDayLabel(newDayLabel);
    const dayObj = routineDays.find((d) => d.label === newDayLabel);
    if (dayObj && dayObj.exercises.length > 0) {
      setExerciseName(dayObj.exercises[0].name);
      setSelectedExercise(dayObj.exercises[0]);
    }
  };

  const handleOpenFeedback = (exercise: ExerciseItem) => {
    setSelectedExercise(exercise);
    setExerciseName(exercise.name);
    setDayLabel(activeDay.label);
    setDifficulty('just_right');
    setPain(false);
    setFeedbackNote('');
    setFeedbackResult(null);

    // Smooth scroll down to feedback form
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
        const adj: ExerciseAdjustment = result.adjustments[0];
        if (adj.new_exercise_name) {
          // Replace exercise in local routineDays table state live!
          setRoutineDays((prevDays) =>
            prevDays.map((d) => {
              if (d.label === dayLabel || d.dayId === activeDay.dayId) {
                return {
                  ...d,
                  exercises: d.exercises.map((ex) => {
                    if (ex.name.toLowerCase() === exerciseName.toLowerCase() || (selectedExercise && ex.id === selectedExercise.id)) {
                      return {
                        ...ex,
                        replacedFrom: ex.name,
                        name: adj.new_exercise_name!,
                        setsReps: adj.sets && adj.reps ? `${adj.sets} sets × ${adj.reps} reps` : ex.setsReps,
                        rpeRest: adj.rpe ? `RPE ${adj.rpe} (AI Adjusted)` : ex.rpeRest,
                        adjustmentReason: adj.reason || 'Adjusted based on feedback & pain report',
                      };
                    }
                    return ex;
                  }),
                };
              }
              return d;
            })
          );
          setExerciseName(adj.new_exercise_name);
        }
        setFeedbackResult(`✨ AI Core Adjusted Routine: Swapped for ${adj.new_exercise_name ?? 'new exercise'}! (${adj.reason})`);
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

  if (!planData) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading AI Training Protocol...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header & Export Action */}
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

      {/* Body Composition Summary Ribbon */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ color: '#10b981' }}>⚡</span>
          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
            InBody Composition Telemetry
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '26px', color: '#34d399', display: 'block' }}>34.2</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>SMM (KG)</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '26px', color: '#38bdf8', display: 'block' }}>14.5%</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>BODY FAT %</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '26px', color: '#fbbf24', display: 'block' }}>1840</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>BMR (KCAL)</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '26px', color: '#f43f5e', display: 'block' }}>2</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>FLAGS</span>
          </div>
        </div>
      </div>

      {/* Routine Days Tabs Switcher */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {routineDays.map((day) => {
          const isActive = day.dayId === activeDay.dayId;
          return (
            <button
              key={day.dayId}
              onClick={() => {
                setActiveDayId(day.dayId);
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

      {/* Active Day Table & Warmup Box */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {activeDay.label}
            </h2>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em' }}>
              TARGET FOCUS: {activeDay.targetFocus}
            </span>
          </div>

          <span className="badge badge-emerald">
            {activeDay.exercises.length} EXERCISES
          </span>
        </div>

        {/* Warmup protocol box */}
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            WARM-UP & MOBILITY PROTOCOL:
          </span>
          <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0 }}>
            {activeDay.warmup}
          </p>
        </div>

        {/* ROUTINE EXERCISES TABLE */}
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
                <tr key={ex.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent' }}>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
                      {ex.name}
                    </div>
                    {ex.replacedFrom && (
                      <span className="badge badge-amber" style={{ padding: '2px 6px', fontSize: '10px', marginTop: '4px' }}>
                        ⚡ AI Replaced (was {ex.replacedFrom})
                      </span>
                    )}
                    {ex.adjustmentReason && (
                      <p style={{ fontSize: '11px', color: '#fbbf24', margin: '2px 0 0 0' }}>
                        Reason: {ex.adjustmentReason}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className="badge badge-emerald" style={{ padding: '4px 10px', fontSize: '11px' }}>
                      {ex.muscle}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {ex.setsReps}
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#cbd5e1' }}>
                    {ex.rpeRest}
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

        {/* RAW PLAN OUTPUT ACCORDION */}
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

        {/* EXERCISE FEEDBACK DROPDOWN LOGGING FORM */}
        <div id="exercise-feedback-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ color: '#34d399' }}>⚡</span>
            <h4 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', color: '#34d399', textTransform: 'uppercase', margin: 0 }}>
              AI Overload & Exercise Swap Studio
            </h4>

          </div>

          <form onSubmit={handleFeedbackSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Day Label Select Dropdown */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Training Day</label>
              <select
                id="feedback-day-label"
                value={dayLabel}
                onChange={(e) => handleDaySelectChange(e.target.value)}
                className="form-select"
                required
              >
                {routineDays.map((d) => (
                  <option key={d.dayId} value={d.label} style={{ background: '#0f172a' }}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Exercise Name Select Dropdown */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exercise Name</label>
              <select
                id="feedback-exercise-name"
                value={exerciseName}
                onChange={(e) => {
                  setExerciseName(e.target.value);
                  const ex = selectedDayObject.exercises.find((item) => item.name === e.target.value);
                  if (ex) setSelectedExercise(ex);
                }}
                className="form-select"
                required
              >
                {selectedDayObject.exercises.map((ex) => (
                  <option key={ex.id} value={ex.name} style={{ background: '#0f172a' }}>
                    {ex.name} ({ex.muscle})
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Select Dropdown */}
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

            {/* Pain / Injury Checkbox & Comments Input */}
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
