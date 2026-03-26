import React, { useState, useRef, useEffect } from 'react';

const ADK_WS_URL = import.meta.env.VITE_ADK_WS_URL || 'ws://localhost:8001';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AskDoubtPanel({ courseTitle, onClose, getPageContext }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [responding, setResponding] = useState(false);
  const [messages, setMessages] = useState([]);
  const [liveUserText, setLiveUserText] = useState('');
  const [liveAiText, setLiveAiText] = useState('');

  const wsRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const captureCtxRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const recordingRef = useRef(false);
  const respondingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);
  const aiTextRef = useRef('');
  const userTextRef = useRef('');

  useEffect(() => () => disconnect(), []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveUserText, liveAiText]);

  function disconnect() {
    if (respondingTimeoutRef.current) clearTimeout(respondingTimeoutRef.current);
    stopMic();
    if (playbackCtxRef.current) { playbackCtxRef.current.close().catch(() => {}); playbackCtxRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setConnected(false); setConnecting(false); setRecording(false); setResponding(false);
    recordingRef.current = false; nextPlayTimeRef.current = 0;
    aiTextRef.current = ''; userTextRef.current = '';
  }

  function stopMic() {
    recordingRef.current = false;
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceNodeRef.current) { sourceNodeRef.current.disconnect(); sourceNodeRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (captureCtxRef.current) { captureCtxRef.current.close().catch(() => {}); captureCtxRef.current = null; }
  }

  function playAudioChunk(pcmBytes) {
    try {
      if (!playbackCtxRef.current) playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      const ctx = playbackCtxRef.current;
      const pcm16 = new Int16Array(pcmBytes);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer; src.connect(ctx.destination);
      const startTime = Math.max(ctx.currentTime + 0.05, nextPlayTimeRef.current);
      src.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    } catch (e) { console.warn('Audio playback error:', e); }
  }

  function commitAiText() {
    const t = aiTextRef.current.trim();
    aiTextRef.current = ''; setLiveAiText('');
    if (t) setMessages(m => [...m, { role: 'ai', text: t, time: Date.now() }]);
  }
  function commitUserText() {
    const t = userTextRef.current.trim();
    userTextRef.current = ''; setLiveUserText('');
    if (t) setMessages(m => [...m, { role: 'user', text: t, time: Date.now() }]);
  }

  function sendJson(data) {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }

  function connectSession() {
    setConnecting(true); setLiveUserText(''); setLiveAiText('');
    aiTextRef.current = ''; userTextRef.current = '';
    // Don't clear messages — preserve chat history across reconnects

    const sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ws = new WebSocket(`${ADK_WS_URL}/ws/${sessionId}`);
    wsRef.current = ws; ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        setResponding(true);
        if (respondingTimeoutRef.current) clearTimeout(respondingTimeoutRef.current);
        respondingTimeoutRef.current = setTimeout(() => { commitAiText(); setResponding(false); }, 6000);
        playAudioChunk(event.data);
        return;
      }
      try {
        const d = JSON.parse(event.data);
        switch (d.type) {
          case 'ready':
          case 'reconnected':
            setConnected(true); setConnecting(false); break;
          case 'turn_complete':
            if (respondingTimeoutRef.current) clearTimeout(respondingTimeoutRef.current);
            commitAiText(); setResponding(false); break;
          case 'input_transcript': {
            // Accumulate — each event is a chunk, not the full text
            const chunk = d.text || '';
            userTextRef.current += chunk;
            setLiveUserText(userTextRef.current);
            if (d.finished) commitUserText();
            break;
          }
          case 'output_transcript': {
            // Accumulate — each event is a chunk
            const chunk = d.text || '';
            aiTextRef.current += chunk;
            setLiveAiText(aiTextRef.current);
            break;
          }
          case 'interrupted': {
            if (respondingTimeoutRef.current) clearTimeout(respondingTimeoutRef.current);
            const p = aiTextRef.current.trim(); aiTextRef.current = ''; setLiveAiText('');
            if (p) setMessages(m => [...m, { role: 'ai', text: p + '...', time: Date.now() }]);
            setResponding(false); break;
          }
          case 'error':
            console.error('Voice server error:', d.message);
            setConnected(false); setConnecting(false); break;
        }
      } catch (e) { console.warn('WS parse:', e); }
    };
    ws.onerror = () => setConnecting(false);
    ws.onclose = () => {
      setConnected(false); setConnecting(false); setResponding(false);
      // DON'T clear messages — keep the chat history visible
    };
  }

  async function startRecording() {
    if (!connected || !wsRef.current) return;
    if (responding) {
      nextPlayTimeRef.current = 0;
      if (playbackCtxRef.current) { playbackCtxRef.current.close().catch(() => {}); playbackCtxRef.current = null; }
      commitAiText(); setResponding(false);
    }
    try {
      nextPlayTimeRef.current = 0;
      // Reset transcript refs for the new turn
      userTextRef.current = ''; setLiveUserText('');
      aiTextRef.current = ''; setLiveAiText('');

      if (getPageContext) {
        const ctx = getPageContext();
        if (ctx) sendJson({ type: 'store_context', image: ctx.imageBase64 || null, context: `Course: ${courseTitle} | Page ${ctx.pageNumber} | Content: ${ctx.pageText || ''}` });
      }
      sendJson({ type: 'activity_start' });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 }); captureCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream); sourceNodeRef.current = source;
      const processor = audioCtx.createScriptProcessor(4096, 1, 1); processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (!recordingRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const f = e.inputBuffer.getChannelData(0); const p = new Int16Array(f.length);
        for (let i = 0; i < f.length; i++) { const s = Math.max(-1, Math.min(1, f[i])); p[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
        wsRef.current.send(p.buffer);
      };
      source.connect(processor); processor.connect(audioCtx.destination);
      recordingRef.current = true; setRecording(true);
    } catch (e) { console.error('Mic error:', e); }
  }

  function stopRecording() {
    recordingRef.current = false; setRecording(false); stopMic();
    sendJson({ type: 'activity_end' });
  }

  // ─── Render ───
  const showChat = connected || messages.length > 0;
  const sessionActive = connected && !connecting;

  return (
    <div style={S.panel}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>Ask Doubt</div>
          <div style={S.headerSub}>{courseTitle}</div>
        </div>
        <button onClick={() => { disconnect(); onClose(); }} style={S.closeBtn}>✕</button>
      </div>

      {/* ── Body ── */}
      {!connected && !connecting && (
        <div style={S.centered}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎓</div>
          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Voice Doubt Solver</div>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5, marginBottom: 16 }}>
            Ask doubts by voice. AI sees your current page and answers contextually.
          </div>
          <button onClick={connectSession} style={S.startBtn}>Start Session</button>
        </div>
      )}

      {connecting && (
        <div style={S.centered}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔄</div>
          <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Connecting to AI tutor...</div>
        </div>
      )}

      {/* ── Chat area ── */}
      {showChat && (
        <div style={S.chatArea}>
          {messages.length === 0 && !liveUserText && !liveAiText && (
            <div style={S.emptyState}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.5 }}>
                Hold the mic button and ask your doubt.<br />Your conversation will appear here.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={msg.role === 'user' ? S.rowRight : S.rowLeft}>
              <div style={msg.role === 'user' ? S.bubbleUser : S.bubbleAi}>
                <div style={S.label}>{msg.role === 'user' ? 'You' : 'Tutor'}</div>
                <div style={S.text}>{msg.text}</div>
                <div style={S.time}>{formatTime(msg.time)}</div>
              </div>
            </div>
          ))}

          {liveUserText && (
            <div style={S.rowRight}>
              <div style={{ ...S.bubbleUser, opacity: 0.6 }}>
                <div style={S.label}>You</div>
                <div style={{ ...S.text, fontStyle: 'italic' }}>{liveUserText}</div>
              </div>
            </div>
          )}

          {liveAiText && (
            <div style={S.rowLeft}>
              <div style={{ ...S.bubbleAi, opacity: 0.6 }}>
                <div style={S.label}>Tutor</div>
                <div style={{ ...S.text, fontStyle: 'italic' }}>{liveAiText}</div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      {/* ── Mic / Reconnect ── */}
      {showChat && (
        <div style={S.micArea}>
          {sessionActive ? (
            <>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => recordingRef.current && stopRecording()}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                style={{
                  ...S.micBtn,
                  background: recording ? '#ef4444' : responding ? '#8b5cf6' : '#3b82f6',
                  boxShadow: recording
                    ? '0 0 0 6px rgba(239,68,68,0.2), 0 0 0 12px rgba(239,68,68,0.1)'
                    : responding
                      ? '0 0 0 6px rgba(139,92,246,0.2)'
                      : '0 0 0 6px rgba(59,130,246,0.15)',
                  transform: recording ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {recording ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                ) : responding ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
              <div style={S.micLabel}>
                {recording ? 'Listening... release to send' : responding ? 'AI is speaking...' : 'Hold to talk'}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 4 }}>Session ended</div>
              <button onClick={connectSession} style={S.reconnectBtn}>Reconnect</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const S = {
  panel: {
    width: 380, minWidth: 380, height: '100%',
    background: '#fff', borderLeft: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },

  // Header
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    background: 'linear-gradient(135deg,#1e40af,#7c3aed)', color: '#fff', flexShrink: 0,
  },
  headerTitle: { fontWeight: 700, fontSize: '0.88rem' },
  headerSub: { fontSize: '0.65rem', opacity: 0.75, marginTop: 1 },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', padding: 4 },

  // Centered states
  centered: { margin: 'auto', textAlign: 'center', padding: 24 },
  startBtn: {
    padding: '10px 28px', background: 'linear-gradient(135deg,#1e40af,#7c3aed)',
    color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  },

  // Chat
  chatArea: {
    flex: 1, overflowY: 'auto', padding: '10px 10px 4px',
    display: 'flex', flexDirection: 'column', gap: 6,
    background: '#f8fafc',
  },
  emptyState: { margin: 'auto', textAlign: 'center', padding: 16 },

  rowRight: { display: 'flex', justifyContent: 'flex-end' },
  rowLeft: { display: 'flex', justifyContent: 'flex-start' },

  bubbleUser: {
    maxWidth: '82%', padding: '8px 11px 4px',
    background: '#dbeafe', borderRadius: '14px 14px 4px 14px',
    wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap',
  },
  bubbleAi: {
    maxWidth: '82%', padding: '8px 11px 4px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px 14px 14px 4px',
    wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap',
  },
  label: {
    fontSize: '0.58rem', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2,
  },
  text: {
    fontSize: '0.8rem', color: '#1e293b', lineHeight: 1.55,
  },
  time: {
    fontSize: '0.55rem', color: '#94a3b8', textAlign: 'right', marginTop: 3,
  },

  // Mic
  micArea: {
    padding: '12px 14px 16px', borderTop: '1px solid #e2e8f0', flexShrink: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    background: '#fff',
  },
  micBtn: {
    width: 64, height: 64, borderRadius: '50%', border: 'none',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
    userSelect: 'none', WebkitUserSelect: 'none',
  },
  micLabel: {
    fontSize: '0.7rem', color: '#64748b', fontWeight: 500,
  },
  reconnectBtn: {
    padding: '8px 24px', background: 'linear-gradient(135deg,#1e40af,#7c3aed)',
    color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
  },
};
