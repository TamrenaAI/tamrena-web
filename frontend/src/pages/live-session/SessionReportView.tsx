import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CvSessionReport } from '../../lib/api';

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { good: boolean };
}

function VerdictDot({ cx = 0, cy = 0, payload }: DotProps) {
  return <circle cx={cx} cy={cy} r={4} fill={payload?.good ? '#34d399' : '#f43f5e'} stroke="#0f172a" strokeWidth={1.5} />;
}

/**
 * Renders the CV engine's own report (score-per-rep + rule-failure
 * breakdown) on the tamreena-web completion screen — previously only
 * reps/good/bad were shown, even though the same data this uses was
 * already available in the standalone Computer-Vision app.
 */
function SessionReportView({ report }: { report: CvSessionReport }) {
  const points = (report.history ?? []).map((r) => ({ rep: r.number, score: r.score, good: r.good }));
  const errorEntries = Object.entries(report.summary?.common_errors ?? {});
  const ruleByName = new Map(report.rules.map((r) => [r.name, r]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
      <div className="glass-panel" style={{ padding: '20px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
          Score Per Repetition
        </span>
        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="rep" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `#${v}`} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={<VerdictDot />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
          Mistakes
        </span>
        {errorEntries.length === 0 ? (
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0 }}>Perfect form — nothing failed.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {errorEntries.map(([rule, count]) => (
              <div key={rule} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{rule}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{count}×</span>
                </div>
                {ruleByName.get(rule)?.message && (
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{ruleByName.get(rule)!.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionReportView;
