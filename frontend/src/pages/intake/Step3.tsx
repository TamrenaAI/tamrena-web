import { useState, type FormEvent } from 'react';
import type { PartialIntake } from './IntakeFlow';
import { PillGroup, type Option } from '../../components/ui/PillGroup';

interface Step3Props {
  initial: PartialIntake;
  onBack: () => void;
  onNext: (patch: PartialIntake) => void;
}

const SLEEP_OPTIONS: Option<string>[] = [
  { value: 'Excellent (8h+)', label: '8+ Hours', sublabel: 'Optimal' },
  { value: 'Good (7-8h)', label: '7-8 Hours', sublabel: 'Standard' },
  { value: 'Moderate (6-7h)', label: '6-7 Hours', sublabel: 'Fair' },
  { value: 'Poor (<6h)', label: '< 6 Hours', sublabel: 'Deficit' },
];

const JOB_OPTIONS: Option<string>[] = [
  { value: 'Desk / Sedentary', label: 'Desk Job' },
  { value: 'Active / Standing', label: 'Standing / Active' },
  { value: 'Physical Labor', label: 'Physical Labor' },
];

const PROGRAM_DROPDOWN_OPTIONS = [
  { value: 'None / New to Training', label: 'None / New to Training' },
  { value: 'Push / Pull / Legs (PPL)', label: 'Push / Pull / Legs (PPL)' },
  { value: 'Upper / Lower 4x Split', label: 'Upper / Lower 4x Split' },
  { value: 'Full Body 3x Split', label: 'Full Body 3x Split' },
  { value: 'Single Muscle Group (Bro Split)', label: 'Single Muscle Group (Bro Split)' },
  { value: 'Arnold Split (Chest/Back, Arms/Delts, Legs)', label: 'Arnold Split' },
  { value: 'Powerlifting / 5-3-1 Strength', label: 'Powerlifting / Strength' },
];

function Step3({ initial, onBack, onNext }: Step3Props) {
  const [sleepQuality, setSleepQuality] = useState(initial.sleep_quality ?? 'Good (7-8h)');
  const [jobType, setJobType] = useState(initial.job_type ?? 'Desk / Sedentary');
  const [currentProgram, setCurrentProgram] = useState(initial.current_program ?? 'Push / Pull / Legs (PPL)');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({
      sleep_quality: sleepQuality || undefined,
      job_type: jobType || undefined,
      current_program: currentProgram || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ marginBottom: '10px' }}>Sleep Duration & Recovery Quality</label>
        <PillGroup options={SLEEP_OPTIONS} value={sleepQuality} onChange={setSleepQuality} idPrefix="intake-sleep" />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ marginBottom: '10px' }}>Daily Occupation Activity</label>
        <PillGroup options={JOB_OPTIONS} value={jobType} onChange={setJobType} idPrefix="intake-job" />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Current Training Split / Program</label>
        <select
          id="intake-current-program"
          value={currentProgram}
          onChange={(e) => setCurrentProgram(e.target.value)}
          className="form-select"
        >
          {PROGRAM_DROPDOWN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#0f172a' }}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <button
          id="intake-step3-back"
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
        >
          ← Back
        </button>
        <button
          id="intake-step3-continue"
          type="submit"
          className="btn btn-primary"
          style={{ padding: '12px 28px', fontSize: '15px' }}
        >
          <span>Continue to InBody Scan</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
        </button>
      </div>
    </form>
  );
}

export default Step3;
