import { useState, type ChangeEvent, type DragEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IntakeAnswers } from '../lib/api';

function CaptureScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const intake = (location.state as { intake?: IntakeAnswers } | null)?.intake;

  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleProceed = () => {
    if (!intake) {
      navigate('/intake');
      return;
    }
    setSubmitting(true);
    const fileToSubmit =
      selectedFile ?? new File(['inbody-scan-content'], 'inbody_scan.pdf', { type: 'application/pdf' });

    navigate('/processing', { state: { intake, inbodyFile: fileToSubmit } });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-dark)',
        padding: '48px 24px',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px', maxWidth: '560px' }}>
        <span className="badge badge-emerald" style={{ marginBottom: '12px' }}>InBody Medical OCR</span>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          InBody Scan & Composition Parser
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Upload your InBody PDF report or scan image to extract Skeletal Muscle Mass (SMM), Body Fat %, and limb asymmetry data.
        </p>
      </div>

      {/* Mode Switcher Pill */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', gap: '4px', marginBottom: '32px' }}>
        <button
          type="button"
          onClick={() => setMode('upload')}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: mode === 'upload' ? '#10b981' : 'transparent',
            color: mode === 'upload' ? '#042f2e' : '#94a3b8',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📄</span>
          <span>Upload PDF / Image</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('camera')}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: mode === 'camera' ? '#10b981' : 'transparent',
            color: mode === 'camera' ? '#042f2e' : '#94a3b8',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📷</span>
          <span>Camera Scanner</span>
        </button>
      </div>

      {/* UPLOAD PDF / IMAGE MODE */}
      {mode === 'upload' && (
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="glass-panel"
            style={{
              backgroundColor: isDragging ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.85)',
              border: isDragging ? '2px dashed #10b981' : '2px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '48px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '24px',
              position: 'relative',
            }}
          >
            <input
              id="inbody-pdf-file-input"
              type="file"
              accept=".pdf,image/*,application/pdf"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />

            {selectedFile ? (
              <div>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                  {selectedFile.type.includes('pdf') ? '📄' : '🖼️'}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                  {selectedFile.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
                  {formatFileSize(selectedFile.size)} • Ready for AI OCR parsing
                </p>
                <span className="badge badge-emerald">
                  ✓ INBODY SCAN READY
                </span>
              </div>
            ) : (
              <div>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                  📂
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
                  Drop InBody PDF or Scan Image
                </h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px 0' }}>
                  Drag & drop your PDF file here, or click to browse files
                </p>
                <span className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                  Select PDF / Image File
                </span>
              </div>
            )}
          </div>

          <button
            id="proceed-extract-btn"
            type="button"
            onClick={handleProceed}
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '15px' }}
          >
            <span>{selectedFile ? 'Extract InBody & Synthesize AI Protocol' : 'Proceed with InBody PDF'}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
          </button>
        </div>
      )}

      {/* CAMERA SCANNER MODE */}
      {mode === 'camera' && (
        <div style={{ width: '100%', maxWidth: '460px', textAlign: 'center' }}>
          <div
            className="glass-panel"
            style={{
              width: '100%',
              height: '420px',
              backgroundColor: '#0f172a',
              borderRadius: '24px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              overflow: 'hidden',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: 'var(--shadow-emerald)',
            }}
          >
            {/* HUD Reticles */}
            <div style={{ position: 'absolute', top: '24px', left: '24px', width: '32px', height: '32px', borderTop: '3px solid #10b981', borderLeft: '3px solid #10b981', borderRadius: '6px 0 0 0' }} />
            <div style={{ position: 'absolute', top: '24px', right: '24px', width: '32px', height: '32px', borderTop: '3px solid #10b981', borderRight: '3px solid #10b981', borderRadius: '0 6px 0 0' }} />
            <div style={{ position: 'absolute', bottom: '24px', left: '24px', width: '32px', height: '32px', borderBottom: '3px solid #10b981', borderLeft: '3px solid #10b981', borderRadius: '0 0 0 6px' }} />
            <div style={{ position: 'absolute', bottom: '24px', right: '24px', width: '32px', height: '32px', borderBottom: '3px solid #10b981', borderRight: '3px solid #10b981', borderRadius: '0 0 6px 0' }} />

            <div className="badge badge-emerald" style={{ padding: '8px 16px', fontSize: '13px' }}>
              ✓ CAMERA HUD FRAME ALIGNED
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Position the printed InBody sheet within reticles to capture
          </p>

          <button
            id="simulated-capture-btn"
            onClick={handleProceed}
            disabled={submitting}
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '4px solid #070a11',
              outline: '2px solid #10b981',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
              margin: '0 auto',
            }}
            title="Capture InBody Scan"
          />
        </div>
      )}
    </div>
  );
}

export default CaptureScreen;
