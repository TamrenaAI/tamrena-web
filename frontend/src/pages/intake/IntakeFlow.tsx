import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IntakeAnswers } from '../../lib/api';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';

export type PartialIntake = Partial<IntakeAnswers>;

function IntakeFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<PartialIntake>({});

  const updateAnswers = (patch: PartialIntake) => setAnswers((prev) => ({ ...prev, ...patch }));

  const handleStep3Submit = (patch: PartialIntake) => {
    const finalAnswers = { ...answers, ...patch } as IntakeAnswers;
    navigate('/capture', { state: { intake: finalAnswers } });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F3EC', padding: '48px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ fontSize: '12px', color: '#8C6F52', marginBottom: '16px' }}>Step {step} of 3</p>
        {step === 1 && (
          <Step1
            initial={answers}
            onNext={(patch) => {
              updateAnswers(patch);
              setStep(2);
            }}
          />
        )}
        {step === 2 && (
          <Step2
            initial={answers}
            onBack={() => setStep(1)}
            onNext={(patch) => {
              updateAnswers(patch);
              setStep(3);
            }}
          />
        )}
        {step === 3 && <Step3 initial={answers} onBack={() => setStep(2)} onNext={handleStep3Submit} />}
      </div>
    </div>
  );
}

export default IntakeFlow;
