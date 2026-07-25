import { useState, type FormEvent } from 'react';
import type { PartialIntake } from './IntakeFlow';

interface Step3Props {
  initial: PartialIntake;
  onBack: () => void;
  onNext: (patch: PartialIntake) => void;
}

function Step3({ initial, onBack, onNext }: Step3Props) {
  const [sleepQuality, setSleepQuality] = useState(initial.sleep_quality ?? '');
  const [jobType, setJobType] = useState(initial.job_type ?? '');
  const [currentProgram, setCurrentProgram] = useState(initial.current_program ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({
      sleep_quality: sleepQuality || undefined,
      job_type: jobType || undefined,
      current_program: currentProgram || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <label>
        Sleep quality (optional)
        <input id="intake-sleep-quality" value={sleepQuality} onChange={(e) => setSleepQuality(e.target.value)} />
      </label>
      <label>
        Job type (optional)
        <input id="intake-job-type" value={jobType} onChange={(e) => setJobType(e.target.value)} />
      </label>
      <label>
        Current program (optional)
        <input id="intake-current-program" value={currentProgram} onChange={(e) => setCurrentProgram(e.target.value)} />
      </label>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button id="intake-step3-back" type="button" onClick={onBack}>
          Back
        </button>
        <button id="intake-step3-continue" type="submit">
          Continue to Capture
        </button>
      </div>
    </form>
  );
}

export default Step3;
