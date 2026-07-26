export interface Option<T extends string> {
  value: T;
  label: string;
  sublabel?: string;
}

interface PillGroupProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  idPrefix?: string;
}

export function PillGroup<T extends string>({ options, value, onChange, idPrefix = 'pill' }: PillGroupProps<T>) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            id={`${idPrefix}-${opt.value}`}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              color: isSelected ? '#34d399' : '#94a3b8',
              fontWeight: isSelected ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isSelected ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none',
            }}
          >
            <span>{opt.label}</span>
            {opt.sublabel && <small style={{ color: isSelected ? '#34d399' : '#64748b', fontSize: '11px', fontWeight: 400 }}>({opt.sublabel})</small>}
          </button>
        );
      })}
    </div>
  );
}
