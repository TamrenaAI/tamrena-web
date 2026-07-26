import { useState, type FormEvent } from 'react';
import type { PartialIntake } from './IntakeFlow';
import { PillGroup, type Option } from '../../components/ui/PillGroup';

interface Step2Props {
  initial: PartialIntake;
  onBack: () => void;
  onNext: (patch: PartialIntake) => void;
}

const PRIORITY_OPTIONS: Option<string>[] = [
  { value: 'Upper Body', label: 'Upper Body' },
  { value: 'Lower Body', label: 'Lower Body' },
  { value: 'Arms & Delts', label: 'Arms & Delts' },
  { value: 'Core & Back', label: 'Core & Back' },
  { value: 'Balanced Full Body', label: 'Full Body' },
];

function Step2({ initial, onBack, onNext }: Step2Props) {
  const [injuries, setInjuries] = useState(initial.injuries ?? '');
  const [priority, setPriority] = useState(initial.priority ?? 'Upper Body');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({ injuries: injuries || undefined, priority: priority || undefined });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '24px' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ marginBottom: '10px' }}>Priority Muscle Group Focus</label>
        <PillGroup options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} idPrefix="intake-priority" />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Injuries or Physical Limitations (Optional)</label>
        <input
          id="intake-injuries"
          value={injuries}
          onChange={(e) => setInjuries(e.target.value)}
          placeholder="e.g. Left shoulder discomfort, lower back tightness"
          className="form-input"
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <button
          id="intake-step2-back"
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
        >
          ← Back
        </button>
        <button
          id="intake-step2-next"
          type="submit"
          className="btn btn-primary"
          style={{ padding: '12px 28px', fontSize: '15px' }}
        >
          <span>Next: Schedule & Recovery</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
        </button>
      </div>
    </form>
  );
}

export default Step2;
