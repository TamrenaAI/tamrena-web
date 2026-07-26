import { useState, type FormEvent } from 'react';
import type { IntakeAnswers } from '../../lib/api';
import type { PartialIntake } from './IntakeFlow';
import { PillGroup, type Option } from '../../components/ui/PillGroup';

interface Step1Props {
  initial: PartialIntake;
  onNext: (patch: PartialIntake) => void;
}

const EXPERIENCE_OPTIONS: Option<IntakeAnswers['experience']>[] = [
  { value: 'beginner', label: 'Beginner', sublabel: '< 1 year' },
  { value: 'intermediate', label: 'Intermediate', sublabel: '1-3 years' },
  { value: 'advanced', label: 'Advanced', sublabel: '3+ years' },
];

const GOAL_DROPDOWN_OPTIONS = [
  { value: 'Hypertrophy', label: 'Hypertrophy (Muscle Mass & Growth)' },
  { value: 'Strength', label: 'Maximal Strength & Power' },
  { value: 'Fat Loss', label: 'Fat Loss & Muscle Retention' },
  { value: 'Recomposition', label: 'Body Recomposition (Fat Loss + Muscle)' },
  { value: 'Endurance', label: 'Endurance & Stamina' },
  { value: 'Athletic Performance', label: 'Athletic Performance & Speed' },
];

const DAYS_DROPDOWN_OPTIONS = [
  { value: 2, label: '2 Days / Week' },
  { value: 3, label: '3 Days / Week' },
  { value: 4, label: '4 Days / Week' },
  { value: 5, label: '5 Days / Week' },
  { value: 6, label: '6 Days / Week' },
];

const DURATION_DROPDOWN_OPTIONS = [
  { value: '30min', label: '30 Minutes' },
  { value: '45min', label: '45 Minutes' },
  { value: '60min', label: '60 Minutes (Standard)' },
  { value: '75min', label: '75 Minutes' },
  { value: '90min', label: '90 Minutes' },
];

function Step1({ initial, onNext }: Step1Props) {
  const [goal, setGoal] = useState(initial.goal ?? 'Hypertrophy');
  const [daysPerWeek, setDaysPerWeek] = useState(initial.days_per_week ?? 4);
  const [experience, setExperience] = useState<IntakeAnswers['experience']>(initial.experience ?? 'beginner');
  const [sessionDuration, setSessionDuration] = useState(initial.session_duration ?? '60min');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({ goal, days_per_week: daysPerWeek, experience, session_duration: sessionDuration });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Primary Training Goal</label>
        <select
          id="intake-goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="form-select"
          required
        >
          {GOAL_DROPDOWN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Weekly Frequency</label>
          <select
            id="intake-days-per-week"
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
            className="form-select"
            required
          >
            {DAYS_DROPDOWN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Session Duration</label>
          <select
            id="intake-session-duration"
            value={sessionDuration}
            onChange={(e) => setSessionDuration(e.target.value)}
            className="form-select"
            required
          >
            {DURATION_DROPDOWN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ marginBottom: '10px' }}>Training Experience Level</label>
        <PillGroup options={EXPERIENCE_OPTIONS} value={experience} onChange={setExperience} idPrefix="intake-exp" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
        <button
          id="intake-step1-next"
          type="submit"
          className="btn btn-primary"
          style={{ padding: '12px 28px', fontSize: '15px' }}
        >
          <span>Next: Focus & Limitations</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
        </button>
      </div>
    </form>
  );
}

export default Step1;
