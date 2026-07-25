import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getComparison,
  getProgressReport,
  getSessions,
  startMonthlyReview,
  type ScanComparison,
  type WorkoutSession,
} from '../../lib/api';

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E2DACB',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '24px',
};

const headingStyle = {
  fontFamily: 'Newsreader, serif',
  fontSize: '20px',
  color: '#211C16',
  marginBottom: '12px',
};

function ProgressTab() {
  const [comparison, setComparison] = useState<ScanComparison | null | undefined>(undefined);
  const [eligibleSessionId, setEligibleSessionId] = useState<string | null>(null);
  const [reportNarrative, setReportNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    getComparison()
      .then(setComparison)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load comparison'));

    getSessions()
      .then(async (sessions: WorkoutSession[]) => {
        const latest = sessions[0];
        if (latest?.eligible_for_review) {
          setEligibleSessionId(latest.session_id);
        }
        const reviewedSession = sessions.find((s) => s.previous_session_id !== null);
        if (reviewedSession) {
          const report = await getProgressReport(reviewedSession.session_id);
          if (report) setReportNarrative(report.narrative);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sessions'));
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setReviewError(null);
  };

  const handleSubmitReview = async () => {
    if (!file || !eligibleSessionId) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      const result = await startMonthlyReview(eligibleSessionId, file);
      setReviewResult(result.progress_report);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to start monthly review');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <p style={{ color: '#A83A2E' }}>{error}</p>;

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '28px', color: '#211C16', marginBottom: '16px' }}>
        Progress
      </h1>

      {comparison === undefined && <p>Loading…</p>}

      {comparison === null && (
        <p style={{ color: '#5B5347', fontSize: '14px' }}>
          Scan again on your next plan to see your progress here.
        </p>
      )}

      {comparison && (
        <div style={cardStyle}>
          <h2 style={headingStyle}>Since Your Last Scan</h2>
          <p style={{ fontSize: '14px', color: '#5B5347' }}>
            Skeletal muscle mass: {comparison.delta.skeletal_muscle_mass_kg >= 0 ? '+' : ''}
            {comparison.delta.skeletal_muscle_mass_kg} kg
          </p>
          <p style={{ fontSize: '14px', color: '#5B5347' }}>
            Body fat: {comparison.delta.body_fat_percent >= 0 ? '+' : ''}
            {comparison.delta.body_fat_percent}%
          </p>
        </div>
      )}

      {reportNarrative && (
        <div style={cardStyle}>
          <h2 style={headingStyle}>Latest Monthly Review</h2>
          <p style={{ fontSize: '14px', color: '#5B5347', whiteSpace: 'pre-wrap' }}>{reportNarrative}</p>
        </div>
      )}

      {eligibleSessionId && !reviewResult && (
        <div style={cardStyle}>
          <h2 style={headingStyle}>Start Monthly Review</h2>
          <p style={{ fontSize: '13px', color: '#5B5347', marginBottom: '12px' }}>
            Upload a fresh InBody scan to review your progress and regenerate your plan.
          </p>
          <input
            id="monthly-review-file-input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
          />
          {reviewError && <p style={{ color: '#A83A2E', fontSize: '13px' }}>{reviewError}</p>}
          <button
            id="monthly-review-submit-btn"
            onClick={handleSubmitReview}
            disabled={!file || submitting}
            style={{ marginTop: '12px', display: 'block' }}
          >
            {submitting ? 'Submitting…' : 'Start Monthly Review'}
          </button>
        </div>
      )}

      {reviewResult && (
        <div style={cardStyle}>
          <h2 style={headingStyle}>Review Complete</h2>
          <p style={{ fontSize: '14px', color: '#5B5347', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
            {reviewResult}
          </p>
          <Link id="view-updated-plan-link" to="/workout" style={{ color: '#B5502E', fontSize: '14px', fontWeight: 600 }}>
            View Your Updated Plan →
          </Link>
        </div>
      )}
    </div>
  );
}

export default ProgressTab;
