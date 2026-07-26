interface Step {
  title: string;
  subtitle?: string;
}

interface FormStepWizardProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function FormStepWizard({ steps, currentStep, onStepClick }: FormStepWizardProps) {
  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Step counter badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
          STEP {currentStep} OF {steps.length} — {steps[currentStep - 1]?.title}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>
          {Math.round((currentStep / steps.length) * 100)}% Completed
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
        <div
          style={{
            height: '100%',
            width: `${(currentStep / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
            borderRadius: '3px',
            boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
            transition: 'width 0.3s ease-in-out',
          }}
        />
      </div>

      {/* Step pills */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => isDone && onStepClick?.(stepNum)}
              disabled={!isDone}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '10px',
                border: isActive ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.06)',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : isDone ? 'rgba(30, 41, 59, 0.6)' : 'rgba(15, 23, 42, 0.5)',
                color: isActive ? '#34d399' : isDone ? '#f8fafc' : '#64748b',
                fontSize: '12px',
                fontWeight: isActive || isDone ? 700 : 500,
                textAlign: 'left',
                cursor: isDone ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#10b981' : isDone ? '#06b6d4' : 'rgba(148, 163, 184, 0.2)',
                  color: isActive || isDone ? '#042f2e' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isDone ? '✓' : stepNum}
              </span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
