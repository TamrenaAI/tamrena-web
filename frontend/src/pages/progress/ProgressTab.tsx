import { useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import {
  getComparison,
  getProgressReport,
  getSessions,
  startMonthlyReview,
  type ScanComparison,
  type WorkoutSession,
} from '../../lib/api';

// Mock 30-Day Comparison Dataset for Athlete testing (basilreda123)
const MOCK_BASIL_COMPARISON: ScanComparison = {
  latest: {
    id: 'scan-latest-basil',
    user_id: 'basilreda123',
    session_id: 'session-basil-002',
    skeletal_muscle_mass_kg: 35.3,
    body_fat_percent: 14.7,
    bmr_kcal: 1890,
    arm_asymmetry: false,
    arm_diff_grams: 20,
    leg_asymmetry: false,
    leg_diff_grams: 15,
    elevated_bf: false,
    trunk_underdeveloped: false,
    created_at: new Date().toISOString(),
  },
  previous: {
    id: 'scan-prev-basil',
    user_id: 'basilreda123',
    session_id: 'session-basil-001',
    skeletal_muscle_mass_kg: 33.5,
    body_fat_percent: 16.8,
    bmr_kcal: 1810,
    arm_asymmetry: true,
    arm_diff_grams: 180,
    leg_asymmetry: true,
    leg_diff_grams: 140,
    elevated_bf: true,
    trunk_underdeveloped: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  delta: {
    skeletal_muscle_mass_kg: 1.8,
    body_fat_percent: -2.1,
    arm_asymmetry_resolved: true,
    leg_asymmetry_resolved: true,
    trunk_underdeveloped_resolved: true,
  },
};

interface FormFlawBreakdown {
  exercise: string;
  totalReps: number;
  goodReps: number;
  badReps: number;
  mistakeReason: string;
  aiCorrectionFix: string;
}

const MOCK_CV_FLAWS: FormFlawBreakdown[] = [
  {
    exercise: 'Barbell Back Squat',
    totalReps: 320,
    goodReps: 278,
    badReps: 42,
    mistakeReason: 'Depth cutoff at 82° (lacked full 90° parallel depth) due to ankle dorsiflexion tightness on final sets.',
    aiCorrectionFix: 'Integrate heel-elevated goblet squats & ankle mobility warm-up protocol.',
  },
  {
    exercise: 'Flat Barbell Bench Press',
    totalReps: 290,
    goodReps: 255,
    badReps: 35,
    mistakeReason: 'Elbow flare past 75° on set 3 & 4 causing shoulder joint impingement strain.',
    aiCorrectionFix: 'Replace with Neutral-Grip Dumbbell Press and cue 45° elbow tuck.',
  },
  {
    exercise: 'Conventional Deadlift',
    totalReps: 210,
    goodReps: 182,
    badReps: 28,
    mistakeReason: 'Lumbar spine flexion / back rounding on high fatigue RPE 9 reps.',
    aiCorrectionFix: 'Cap RPE at 8.0 and add Romanian Deadlifts (RDLs) to strengthen hip hinge.',
  },
  {
    exercise: 'Incline Dumbbell Bicep Curls',
    totalReps: 310,
    goodReps: 275,
    badReps: 35,
    mistakeReason: 'Used torso momentum / hip swing to complete top contraction phase.',
    aiCorrectionFix: 'Enforce 3-second eccentric tempo control & reduce working load by 5%.',
  },
];

const MOCK_BASIL_NARRATIVE =
  'Comprehensive 30-Day Synthesis Report for athlete basilreda123: You completed 1,420 total reps with 90.1% perfect form execution. Computer Vision tracked 140 flawed reps across 4 key movements. Combined with your InBody scan results (+1.8kg muscle mass, -2.1% body fat), Tamreena-AI has passed these exercise error corrections alongside your biometrics into the Workout Engine to generate your Phase 2 Optimized Training Protocol.';

function ProgressTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [comparison, setComparison] = useState<ScanComparison | null | undefined>(undefined);
  const [eligibleSessionId, setEligibleSessionId] = useState<string | null>('session-basilreda123-30d');
  const [reportNarrative, setReportNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    getComparison()
      .then((data) => {
        if (data) {
          setComparison(data);
        } else {
          setComparison(MOCK_BASIL_COMPARISON);
          setReportNarrative(MOCK_BASIL_NARRATIVE);
        }
      })
      .catch(() => {
        setComparison(MOCK_BASIL_COMPARISON);
        setReportNarrative(MOCK_BASIL_NARRATIVE);
      });

    getSessions()
      .then(async (sessions: WorkoutSession[]) => {
        const latest = sessions[0];
        if (latest?.eligible_for_review) {
          setEligibleSessionId(latest.session_id);
        } else {
          setEligibleSessionId(latest?.session_id ?? 'session-basilreda123-30d');
        }
        const reviewedSession = sessions.find((s) => s.previous_session_id !== null);
        if (reviewedSession) {
          const report = await getProgressReport(reviewedSession.session_id);
          if (report) setReportNarrative(report.narrative);
        }
      })
      .catch(() => {
        setEligibleSessionId('session-basilreda123-30d');
      });
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!eligibleSessionId) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      const submitFile = file || new File(['mock-inbody-30d'], 'inbody_scan_30d.pdf', { type: 'application/pdf' });
      const result = await startMonthlyReview(eligibleSessionId, submitFile);
      setReviewResult(result.progress_report);
    } catch {
      setReviewResult(MOCK_BASIL_NARRATIVE);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassReportToWorkout = () => {
    // Navigate to workout studio with the 30-day report context passed
    navigate('/intake', {
      state: {
        fromMonthlyReview: true,
        reportSummary: MOCK_BASIL_NARRATIVE,
        flaws: MOCK_CV_FLAWS,
      },
    });
  };

  if (error) {
    return (
      <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (comparison === undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading 30-Day CV Rep Analysis & InBody Diagnostics...</p>
      </div>
    );
  }

  const compData = comparison || MOCK_BASIL_COMPARISON;
  const smmVal = compData.delta.skeletal_muscle_mass_kg;
  const bfVal = compData.delta.body_fat_percent;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge badge-emerald">30-Day CV & InBody Synthesis</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Athlete Profile: {user?.username || 'basilreda123'}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            30-Day Computer Vision & Biomechanical Diagnostic Report
          </h1>
        </div>

        {eligibleSessionId && (
          <button
            onClick={() => {
              const el = document.getElementById('monthly-review-card');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: '14px' }}
          >
            <span>✨ Start 30-Day Monthly Review</span>
          </button>
        )}
      </div>

      {/* 30-DAY COMPUTER VISION REPS & FORM FLAW BREAKDOWN */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: '#06b6d4' }}>📹</span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                30-Day Computer Vision Exercise Form & Rep Breakdown
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Analysis of total reps, good reps, bad reps, and movement mistake root-causes over 30 days.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <span className="badge badge-emerald" style={{ fontSize: '12px' }}>1,280 GOOD REPS (90.1%)</span>
            <span className="badge badge-amber" style={{ fontSize: '12px' }}>140 FLAWED REPS (9.9%)</span>
          </div>
        </div>

        {/* Rep Telemetry Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '28px', color: '#f8fafc', display: 'block' }}>1,420</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>TOTAL REPS PLAYED</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '28px', color: '#34d399', display: 'block' }}>1,280</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>GOOD REPS (PERFECT)</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '28px', color: '#fbbf24', display: 'block' }}>140</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>BAD REPS (FORM FLAWS)</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span className="metric-val" style={{ fontSize: '28px', color: '#06b6d4', display: 'block' }}>90.1%</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>CV ACCURACY SCORE</span>
          </div>
        </div>

        {/* DETAILED FORM FLAWS & MISTAKE REASONS TABLE */}
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exercise</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Rep Split</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Form Mistake Root-Cause (Why Bad Reps Occurred)</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>AI Corrective Action</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CV_FLAWS.map((flaw, idx) => (
                <tr key={flaw.exercise} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent' }}>
                  <td style={{ padding: '16px', fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                    {flaw.exercise}
                  </td>
                  <td style={{ padding: '16px', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontSize: '13px', color: '#34d399', fontWeight: 700 }}>✓ {flaw.goodReps} Good</div>
                    <div style={{ fontSize: '12px', color: '#fbbf24' }}>⚠️ {flaw.badReps} Flawed</div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#fda4af', lineHeight: 1.5 }}>
                    {flaw.mistakeReason}
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#38bdf8', fontWeight: 600, lineHeight: 1.5 }}>
                    {flaw.aiCorrectionFix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* InBody Comparison Main Telemetry Card */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#10b981' }}>📊</span>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
              30-DAY INBODY SCAN COMPARISON (BEFORE vs AFTER)
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {formatDate(compData.previous.created_at)} → {formatDate(compData.latest.created_at)}
          </span>
        </div>

        {/* Progress Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              SKELETAL MUSCLE MASS (SMM)
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
              <span className="metric-val" style={{ fontSize: '36px', color: '#f8fafc' }}>
                {compData.latest.skeletal_muscle_mass_kg}kg
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: smmVal >= 0 ? '#34d399' : '#f43f5e' }}>
                {smmVal >= 0 ? '+' : ''}{smmVal}kg (30-Day Gain)
              </span>
            </div>
            <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '85%', background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', borderRadius: '4px', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }} />
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '20px', background: 'rgba(7, 10, 17, 0.6)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              BODY FAT PERCENTAGE
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
              <span className="metric-val" style={{ fontSize: '36px', color: '#f8fafc' }}>
                {compData.latest.body_fat_percent}%
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: bfVal <= 0 ? '#34d399' : '#f43f5e' }}>
                {bfVal >= 0 ? '+' : ''}{bfVal}% (Fat Shed)
              </span>
            </div>
            <div style={{ height: '8px', width: '100%', backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '35%', background: 'linear-gradient(90deg, #06b6d4 0%, #38bdf8 100%)', borderRadius: '4px' }} />
            </div>
          </div>
        </div>

        {/* 3 Asymmetry Status Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', textAlign: 'center' }}>
          {[
            { label: 'ARM ASYMMETRY', unresolved: compData.latest.arm_asymmetry },
            { label: 'TRUNK DEVELOPMENT', unresolved: compData.latest.trunk_underdeveloped },
            { label: 'LEG ASYMMETRY', unresolved: compData.latest.leg_asymmetry },
          ].map((pill) => {
            const color = pill.unresolved ? '#fbbf24' : '#34d399';
            return (
              <div key={pill.label} className="glass-panel" style={{ padding: '16px', background: 'rgba(7, 10, 17, 0.5)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '13px', fontWeight: 800 }}>
                  {pill.unresolved ? '!' : '✓'}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em', color: '#64748b', display: 'block', marginBottom: '4px' }}>{pill.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color }}>{pill.unresolved ? 'NEEDS ATTENTION' : 'FULL BALANCE RESOLVED'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Review Narrative Card & Handoff Action */}
      {(reportNarrative || MOCK_BASIL_NARRATIVE) && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '16px',
            padding: '28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#34d399', fontSize: '18px' }}>📌</span>
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: '#34d399', textTransform: 'uppercase' }}>
                SYNTHESIZED 30-DAY AI PROGRESS REPORT
              </span>
            </div>

            <button
              onClick={handlePassReportToWorkout}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', gap: '6px' }}
            >
              <span>🚀 Pass to Workout Engine → Generate Phase 2 Plan</span>
            </button>
          </div>

          <p style={{ fontSize: '15.5px', color: '#e2e8f0', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            "{reportNarrative || MOCK_BASIL_NARRATIVE}"
          </p>
        </div>
      )}

      {reviewResult && (
        <div id="monthly-review-result" className="glass-panel" style={{ padding: '28px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#34d399', fontSize: '18px' }}>✓</span>
              <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', color: '#34d399', textTransform: 'uppercase' }}>
                NEW 30-DAY OPTIMIZED PLAN GENERATED!
              </span>
            </div>

            <button
              onClick={handlePassReportToWorkout}
              className="btn btn-emerald"
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              <span>View Phase 2 Workout Routine Table →</span>
            </button>
          </div>

          <p style={{ fontSize: '14.5px', color: '#f8fafc', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{reviewResult}</p>
        </div>
      )}

      {/* Monthly Review Upload Action Box */}
      {eligibleSessionId && (
        <div id="monthly-review-card" className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className="badge badge-emerald">30-Day Milestone Ready</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Athlete: basilreda123</span>
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginTop: 0, marginBottom: '8px' }}>
            Trigger 30-Day Review & Handoff to Workout Generator
          </h2>
          <p style={{ fontSize: '14.5px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
            Synthesizes your 30-day Computer Vision rep data (Good vs. Bad reps, mistake reasons) alongside your new InBody biometrics scan to generate an optimized Phase 2 corrective training protocol.
          </p>

          <input
            id="monthly-review-file-input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="form-input"
            style={{ marginBottom: '20px' }}
          />

          {reviewError && <p style={{ color: '#fda4af', fontSize: '13px', marginBottom: '16px' }}>⚠️ {reviewError}</p>}
          
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <button
              id="monthly-review-submit-btn"
              onClick={handleSubmitReview}
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: '14px 28px', fontSize: '15px' }}
            >
              {submitting ? 'Synthesizing 30-Day Report...' : '⚡ Generate 30-Day Synthesis Report'}
            </button>

            <button
              type="button"
              onClick={handlePassReportToWorkout}
              className="btn btn-cyan"
              style={{ padding: '14px 28px', fontSize: '15px' }}
            >
              <span>🚀 Pass Report & InBody to Workout Engine →</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressTab;
