import { useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { validateImage, type IntakeAnswers } from '../lib/api';

interface CaptureLocationState {
  intake: IntakeAnswers;
}

function CaptureScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const intake = (location.state as CaptureLocationState | null)?.intake;

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (!intake) {
    navigate('/intake', { replace: true });
    return null;
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const handleContinue = async () => {
    if (!file) return;
    setChecking(true);
    setError(null);
    try {
      const result = await validateImage(file);
      if (!result.valid) {
        setError(result.issue ?? 'This does not look like a valid InBody scan.');
        return;
      }
      navigate('/processing', { state: { intake, inbodyFile: file } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate image');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F3EC', padding: '48px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Newsreader, serif', fontSize: '24px', color: '#211C16', marginBottom: '16px' }}>
          Upload your InBody scan
        </h1>
        <input id="capture-file-input" type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
        {error && <p style={{ color: '#A83A2E', fontSize: '13px' }}>{error}</p>}
        <button
          id="capture-continue-btn"
          onClick={handleContinue}
          disabled={!file || checking}
          style={{ marginTop: '16px' }}
        >
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export default CaptureScreen;
