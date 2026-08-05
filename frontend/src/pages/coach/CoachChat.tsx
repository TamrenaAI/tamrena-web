import { useEffect, useRef, useState } from 'react';
import { getCoachHistory, sendCoachMessage, type CoachMessage } from '../../lib/api';

interface DisplayMessage extends CoachMessage {
  id: string;
  error?: string;
}

function CoachChat() {
  const [messages, setMessages] = useState<DisplayMessage[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCoachHistory()
      .then((history) => setMessages(history.map((m, i) => ({ ...m, id: `history-${i}` }))))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load chat history'));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMessageId = `local-${Date.now()}`;
    setMessages((prev) => [...(prev ?? []), { id: userMessageId, role: 'user', content: text }]);
    setDraft('');
    setSending(true);

    try {
      const reply = await sendCoachMessage(text);
      setMessages((prev) => [...(prev ?? []), { id: `${userMessageId}-reply`, role: 'assistant', content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setMessages((prev) =>
        (prev ?? []).map((m) => (m.id === userMessageId ? { ...m, error: message } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af' }}>
        ⚠️ {loadError}
      </div>
    );
  }

  if (messages === undefined) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading your conversation...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 134px)', maxWidth: '760px', margin: '0 auto' }}>
      <div
        ref={scrollRef}
        className="glass-panel"
        style={{ flex: 1, overflowY: 'auto', padding: '24px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
            Ask me about your workout or nutrition plan.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '14px',
                fontSize: '14px',
                lineHeight: 1.5,
                background: m.role === 'user' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                border: m.role === 'user' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
              }}
            >
              {m.content}
              {m.error && (
                <p style={{ color: '#fda4af', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>⚠️ {m.error}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '14px',
              }}
            >
              thinking…
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about your workout or nutrition plan..."
          disabled={sending}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#f8fafc',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="btn btn-primary"
          style={{ padding: '12px 24px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default CoachChat;
