import { useState, type FormEvent } from 'react';
import type { PartialIntake } from './IntakeFlow';

interface Step2Props {
  initial: PartialIntake;
  onBack: () => void;
  onNext: (patch: PartialIntake) => void;
}

function Step2({ initial, onBack, onNext }: Step2Props) {
  const [injuries, setInjuries] = useState(initial.injuries ?? '');
  const [priority, setPriority] = useState(initial.priority ?? '');
  const [age, setAge] = useState<number | undefined>(initial.age);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onNext({ injuries: injuries || undefined, priority: priority || undefined, age });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <label>
        Injuries / limitations (optional)
        <input id="intake-injuries" value={injuries} onChange={(e) => setInjuries(e.target.value)} />
      </label>
      <label>
        Priority focus (optional)
        <input id="intake-priority" value={priority} onChange={(e) => setPriority(e.target.value)} />
      </label>
      <label>
        Age (optional)
        <input
          id="intake-age"
          type="number"
          value={age ?? ''}
          onChange={(e) => setAge(e.target.value ? Number(e.target.value) : undefined)}
        />
      </label>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button id="intake-step2-back" type="button" onClick={onBack}>
          Back
        </button>
        <button id="intake-step2-next" type="submit">
          Next
        </button>
      </div>
    </form>
  );
}

export default Step2;
