import { useState, type FormEvent } from 'react';
import type { IntakeAnswers } from '../../lib/api';
import type { PartialIntake } from './IntakeFlow';

interface Step1Props {
  initial: PartialIntake;
  onNext: (patch: PartialIntake) => void;
}

function Step1({ initial, onNext }: Step1Props) {
  const [goal, setGoal] = useState(initial.goal ?? '');
  const [daysPerWeek, setDaysPerWeek] = useState(initial.days_per_week ?? 4);
  const [experience, setExperience] = useState<IntakeAnswers['experience']>(initial.experience ?? 'beginner');
  const [sessionDuration, setSessionDuration] = useState(initial.session_duration ?? '60min');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({ goal, days_per_week: daysPerWeek, experience, session_duration: sessionDuration });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <label>
        Goal
        <input id="intake-goal" value={goal} onChange={(e) => setGoal(e.target.value)} required />
      </label>
      <label>
        Days per week (2-6)
        <input
          id="intake-days-per-week"
          type="number"
          min={2}
          max={6}
          value={daysPerWeek}
          onChange={(e) => setDaysPerWeek(Number(e.target.value))}
          required
        />
      </label>
      <label>
        Experience
        <select
          id="intake-experience"
          value={experience}
          onChange={(e) => setExperience(e.target.value as IntakeAnswers['experience'])}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      <label>
        Session duration
        <input
          id="intake-session-duration"
          value={sessionDuration}
          onChange={(e) => setSessionDuration(e.target.value)}
          placeholder="60min"
          pattern="\d{2,3}min"
          required
        />
      </label>
      <button id="intake-step1-next" type="submit">
        Next
      </button>
    </form>
  );
}

export default Step1;
