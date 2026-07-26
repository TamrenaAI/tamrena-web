import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeAnswers } from '../../lib/api';
import { FormStepWizard } from '../../components/ui/FormStepWizard';
import Step1 from './Step1';
import Step2 from './Step2';
import Step3 from './Step3';

export type PartialIntake = Partial<IntakeAnswers>;

function IntakeFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<PartialIntake>({});

  const fromReview = location.state?.fromMonthlyReview;
  const reportSummary = location.state?.reportSummary;

  const updateAnswers = (patch: PartialIntake) => setAnswers((prev) => ({ ...prev, ...patch }));

  const handleStep3Submit = (patch: PartialIntake) => {
    const finalAnswers = { ...answers, ...patch } as IntakeAnswers;
    navigate('/capture', { state: { intake: finalAnswers, fromMonthlyReview: fromReview } });
  };

  const steps = [
    { title: 'Training Goals' },
    { title: 'Equipment & Focus' },
    { title: 'Schedule & Recovery' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-dark)', padding: '48px 24px', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: '680px', width: '100%' }}>
        {fromReview && (
          <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#34d399', fontSize: '18px' }}>⚡</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                30-DAY CV ERROR REPORT & INBODY SCAN RECEIVED
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: '#e2e8f0', margin: 0, lineHeight: 1.5 }}>
              {reportSummary || 'Passing 30-day Computer Vision rep flaw analysis (Squat depth, Bench elbow flare, Deadlift lumbar, Bicep swing) and InBody delta (+1.8kg SMM, -2.1% Body Fat) into the AI Workout Engine for Phase 2 Protocol generation.'}
            </p>
          </div>
        )}

        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <span className="badge badge-emerald" style={{ marginBottom: '12px' }}>AI Routine Builder</span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            Workout Protocol Assessment
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>
            Configure your strength targets, weekly split availability, and physical parameters.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '36px', background: 'rgba(15, 23, 42, 0.85)' }}>
          <FormStepWizard steps={steps} currentStep={step} onStepClick={(s) => setStep(s)} />

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
    </div>
  );
}

export default IntakeFlow;
