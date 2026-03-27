import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const TABS = ['New Content', 'Incomplete', 'History', 'Quiz', 'Ask a Question'];

const tabIcons = {
  'New Content': '🆕',
  'Incomplete': '⏳',
  'History': '✅',
  'Quiz': '📝',
  'Ask a Question': '💬',
};

export default function MyCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('New Content');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/my-courses')
      .then(res => setCourses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const newContent  = courses.filter(c => c.type !== 'quiz' && !c.first_opened_at && !c.completed);
  const incomplete  = courses.filter(c => c.type !== 'quiz' && c.first_opened_at && !c.completed);
  const history     = courses.filter(c => c.type !== 'quiz' && c.completed);
  const quizzes     = courses.filter(c => c.type === 'quiz');

  const counts = {
    'New Content': newContent.length,
    'Incomplete': incomplete.length,
    'History': history.length,
    'Quiz': quizzes.length,
  };

  const tabData = { 'New Content': newContent, 'Incomplete': incomplete, 'History': history, 'Quiz': quizzes };

  if (loading) return <div style={styles.center}>Loading your courses...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h2 style={styles.title}>My Training</h2>
        <p style={styles.sub}>Welcome back, {user?.name}</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}
          >
            {tabIcons[t]} {t}
            {counts[t] > 0 && (
              <span style={{ ...styles.badge, background: tab === t ? 'rgba(255,255,255,0.3)' : '#e2e8f0', color: tab === t ? 'white' : '#64748b' }}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === 'New Content'     && <CourseList items={newContent} tab="new" navigate={navigate} userName={user?.name} />}
        {tab === 'Incomplete'      && <CourseList items={incomplete} tab="incomplete" navigate={navigate} userName={user?.name} />}
        {tab === 'History'         && <CourseList items={history} tab="history" navigate={navigate} userName={user?.name} />}
        {tab === 'Quiz'            && <QuizList items={quizzes} navigate={navigate} />}
        {tab === 'Ask a Question'  && <AskQuestion completedCourses={history} />}
      </div>
    </div>
  );
}

const HISTORY_PER_PAGE = 10;

function downloadCertificate(userName, courseTitle, completedAt) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 16;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Inner border
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  // Header band
  const grad = ctx.createLinearGradient(0, 60, canvas.width, 200);
  grad.addColorStop(0, '#1e40af');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.fillRect(40, 40, canvas.width - 80, 160);

  // Header text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Certificate of Completion', canvas.width / 2, 148);

  // Subtitle
  ctx.fillStyle = '#1e293b';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('This is to certify that', canvas.width / 2, 270);

  // Name
  ctx.fillStyle = '#1e40af';
  ctx.font = 'bold 60px Georgia, serif';
  ctx.fillText(userName || 'Learner', canvas.width / 2, 360);

  // Underline under name
  const nameWidth = ctx.measureText(userName || 'Learner').width;
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - nameWidth / 2, 375);
  ctx.lineTo(canvas.width / 2 + nameWidth / 2, 375);
  ctx.stroke();

  // Has completed
  ctx.fillStyle = '#1e293b';
  ctx.font = '28px Georgia, serif';
  ctx.fillText('has successfully completed the course', canvas.width / 2, 430);

  // Course title
  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 40px Georgia, serif';
  // Wrap long titles
  const maxWidth = canvas.width - 160;
  const words = (courseTitle || 'Healthcare Course').split(' ');
  let line = '';
  let y = 510;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, canvas.width / 2, y);
      line = word;
      y += 52;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, canvas.width / 2, y);

  // Date
  const dateStr = completedAt ? new Date(completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  ctx.fillStyle = '#64748b';
  ctx.font = '24px Georgia, serif';
  ctx.fillText(`Completed on ${dateStr}`, canvas.width / 2, y + 80);

  // Seal circle
  ctx.beginPath();
  ctx.arc(canvas.width / 2, y + 170, 55, 0, Math.PI * 2);
  ctx.fillStyle = '#16a34a';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial';
  ctx.fillText('✓', canvas.width / 2, y + 183);

  // Footer
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px Arial';
  ctx.fillText('Healthcare Training Platform', canvas.width / 2, canvas.height - 60);

  const link = document.createElement('a');
  link.download = `Certificate_${(courseTitle || 'Course').replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function CourseList({ items, tab, navigate, userName }) {
  const [page, setPage] = useState(1);

  const emptyMessages = {
    new: { icon: '🎉', text: 'You\'re all caught up! No new courses assigned.' },
    incomplete: { icon: '✅', text: 'No courses in progress — you\'re on track!' },
    history: { icon: '📚', text: 'No completed courses yet. Start from New Content.' },
  };

  if (items.length === 0) {
    const msg = emptyMessages[tab];
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{msg.icon}</div>
        <p style={{ color: '#64748b' }}>{msg.text}</p>
      </div>
    );
  }

  const paginated = tab === 'history' ? items.slice((page - 1) * HISTORY_PER_PAGE, page * HISTORY_PER_PAGE) : items;
  const totalPages = tab === 'history' ? Math.ceil(items.length / HISTORY_PER_PAGE) : 1;
  const accentColor = tab === 'history' ? '#16a34a' : tab === 'incomplete' ? '#f59e0b' : '#1e40af';

  return (
    <div>
      <div style={styles.list}>
        {paginated.map(course => (
          <div key={course.id} style={{ ...styles.card, borderLeft: `4px solid ${accentColor}` }}>
            <div style={styles.cardLeft}>
              <div style={styles.cardTop}>
                <span style={{ ...styles.typeBadge, background: course.type === 'pdf' ? '#dbeafe' : course.type === 'video' ? '#fef9c3' : '#ede9fe', color: course.type === 'pdf' ? '#1d4ed8' : course.type === 'video' ? '#b45309' : '#6d28d9' }}>
                  {course.type === 'pdf' ? '📄 PDF' : course.type === 'video' ? '🎬 Video' : '📦 SCORM'}
                </span>
                {tab === 'history' && (
                  <span style={styles.completionBadge}>🏅 Completed</span>
                )}
                {tab === 'incomplete' && <span style={styles.inProgressTag}>⏳ In Progress</span>}
              </div>
              <h3 style={styles.cardTitle}>{course.title}</h3>
              <p style={styles.cardMeta}>Assigned {new Date(course.launched_at).toLocaleDateString()}</p>
              {tab === 'incomplete' && course.first_opened_at && (
                <p style={styles.openedDate}>Opened {new Date(course.first_opened_at).toLocaleDateString()}</p>
              )}
              {tab === 'history' && course.acknowledged_at && (
                <p style={styles.doneDate}>Completed on {new Date(course.acknowledged_at).toLocaleString()}</p>
              )}
            </div>
            <div style={styles.cardActions}>
              {tab === 'history' && (
                <button
                  onClick={() => downloadCertificate(userName, course.title, course.acknowledged_at)}
                  style={styles.certBtn}
                >
                  🎓 Download Certificate
                </button>
              )}
              <button
                onClick={() => navigate(`/my-courses/${course.id}`)}
                style={{ ...styles.actionBtn, background: accentColor }}
              >
                {tab === 'history' ? '↩ Review Again' : tab === 'incomplete' ? '▶ Continue' : '▶ Start Course'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {tab === 'history' && totalPages > 1 && (
        <div style={styles.pagination}>
          <span style={styles.pageInfo}>Showing {(page - 1) * HISTORY_PER_PAGE + 1}–{Math.min(page * HISTORY_PER_PAGE, items.length)} of {items.length} courses</span>
          <div style={styles.pageButtons}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={styles.pageBtn}>«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={styles.pageBtn}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ ...styles.pageBtn, ...(p === page ? styles.pageBtnActive : {}) }}>{p}</button>
            ))}
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={styles.pageBtn}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={styles.pageBtn}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizList({ items, navigate }) {
  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
        <p style={{ color: '#64748b' }}>No quizzes assigned to you yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {items.map(quiz => {
        const attempt = quiz.latest_attempt;
        const passed = attempt?.passed;
        const score = attempt?.score;

        return (
          <div key={quiz.id} style={{ ...styles.card, borderLeft: `4px solid ${passed ? '#16a34a' : attempt ? '#ef4444' : '#7c3aed'}` }}>
            <div style={styles.cardTop}>
              <span style={{ ...styles.typeBadge, background: '#fdf4ff', color: '#7c3aed' }}>📝 Quiz</span>
              {passed && <span style={styles.completedTag}>✅ Passed</span>}
              {attempt && !passed && <span style={styles.failedTag}>❌ Failed</span>}
              {!attempt && <span style={styles.newTag}>New</span>}
            </div>

            <h3 style={styles.cardTitle}>{quiz.title}</h3>
            <p style={styles.cardMeta}>Pass score: {quiz.pass_score}%</p>

            {attempt && (
              <div style={{ ...styles.scoreRow, background: passed ? '#f0fdf4' : '#fef2f2' }}>
                <span style={{ color: passed ? '#16a34a' : '#dc2626', fontWeight: '700', fontSize: '1.1rem' }}>
                  {score}%
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  Last attempt: {new Date(attempt.attempted_at).toLocaleDateString()}
                </span>
              </div>
            )}

            <button
              onClick={() => navigate(`/quiz/${quiz.id}`)}
              style={{ ...styles.actionBtn, background: passed ? '#16a34a' : '#7c3aed' }}
            >
              {passed ? '↩ Retake Quiz' : attempt ? '🔄 Retake Quiz' : '▶ Start Quiz'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AskQuestion({ completedCourses }) {
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const pdfCourses = completedCourses.filter(c => c.type === 'pdf');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setError('');
    setChat(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const history = chat.map(m => ({ role: m.role, text: m.text }));
      const res = await api.post('/api/ai/ask-history', { question: q, history });
      setChat(prev => [...prev, { role: 'ai', text: res.data.answer }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get answer. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={aq.wrapper}>
      {/* Context info */}
      <div style={aq.contextBar}>
        <span style={aq.contextLabel}>📚 Answering based on your completed courses:</span>
        {pdfCourses.length === 0
          ? <span style={aq.noContext}>No completed PDF courses yet — complete a course first to ask questions about it.</span>
          : pdfCourses.map(c => (
            <span key={c.id} style={aq.courseChip}>{c.title}</span>
          ))}
      </div>

      {/* Chat messages */}
      <div style={aq.chatArea}>
        {chat.length === 0 && (
          <div style={aq.emptyState}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
            <p style={{ color: '#64748b', margin: 0 }}>Ask any question about your completed courses.</p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.4rem' }}>e.g. "What are the steps for CPR?" or "Explain hand hygiene protocols"</p>
          </div>
        )}
        {chat.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? aq.rowRight : aq.rowLeft}>
            <div style={msg.role === 'user' ? aq.bubbleUser : aq.bubbleAi}>
              <div style={aq.bubbleLabel}>{msg.role === 'user' ? 'You' : 'AI Tutor'}</div>
              <div style={aq.bubbleText}>{msg.text}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={aq.rowLeft}>
            <div style={aq.bubbleAi}>
              <div style={aq.bubbleLabel}>AI Tutor</div>
              <div style={{ ...aq.bubbleText, color: '#94a3b8' }}>Thinking...</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={aq.inputRow}>
        {error && <p style={aq.errorMsg}>{error}</p>}
        <div style={aq.inputWrap}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Type your question and press Enter..."
            style={aq.input}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !question.trim()} style={aq.sendBtn}>
            {loading ? '...' : 'Ask →'}
          </button>
        </div>
      </form>
    </div>
  );
}

const aq = {
  wrapper: { display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', height: '75vh' },
  contextBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', padding: '1rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  contextLabel: { color: '#374151', fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap' },
  noContext: { color: '#94a3b8', fontSize: '0.92rem' },
  courseChip: { padding: '0.25rem 0.75rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.88rem', fontWeight: '600' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc' },
  emptyState: { margin: 'auto', textAlign: 'center', padding: '2rem' },
  rowRight: { display: 'flex', justifyContent: 'flex-end' },
  rowLeft: { display: 'flex', justifyContent: 'flex-start' },
  bubbleUser: { maxWidth: '72%', padding: '0.9rem 1.2rem', background: '#1e40af', color: 'white', borderRadius: '14px 14px 4px 14px' },
  bubbleAi: { maxWidth: '80%', padding: '0.9rem 1.2rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px 14px 14px 4px', whiteSpace: 'pre-wrap' },
  bubbleLabel: { fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', opacity: 0.7 },
  bubbleText: { fontSize: '1rem', lineHeight: 1.7 },
  inputRow: { padding: '1.1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: 'white', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  errorMsg: { color: '#dc2626', fontSize: '0.9rem', margin: 0 },
  inputWrap: { display: 'flex', gap: '0.75rem' },
  input: { flex: 1, padding: '0.85rem 1.1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', outline: 'none' },
  sendBtn: { padding: '0.85rem 1.75rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '1rem', whiteSpace: 'nowrap' },
};

const styles = {
  page: { padding: '2rem 2.5rem' },
  center: { textAlign: 'center', padding: '4rem', color: '#64748b' },
  pageHeader: { marginBottom: '1.75rem' },
  title: { color: '#1e293b', fontSize: '2rem', margin: 0, fontWeight: '800' },
  sub: { color: '#64748b', fontSize: '1.05rem', marginTop: '0.35rem' },
  tabs: { display: 'flex', gap: '0.65rem', marginBottom: '1.75rem', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.3rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '1rem' },
  activeTab: { background: '#1e40af', color: 'white', borderColor: '#1e40af' },
  badge: { padding: '0.1rem 0.55rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700' },
  content: {},
  empty: { textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  list: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  card: { background: 'white', borderRadius: '14px', padding: '1.25rem 1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 },
  cardTop: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  cardActions: { display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'stretch', flexShrink: 0 },
  completionBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.8rem', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', borderRadius: '999px', fontSize: '0.85rem', fontWeight: '700', boxShadow: '0 2px 6px rgba(22,163,74,0.35)' },
  certBtn: { padding: '0.6rem 1.1rem', background: 'linear-gradient(135deg, #1e40af, #7c3aed)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap' },
  pagination: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' },
  pageInfo: { color: '#64748b', fontSize: '0.9rem' },
  pageButtons: { display: 'flex', gap: '0.35rem' },
  pageBtn: { padding: '0.4rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' },
  pageBtnActive: { background: '#1e40af', color: 'white', borderColor: '#1e40af', fontWeight: '700' },
  typeBadge: { padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: '600' },
  completedTag: { color: '#16a34a', fontSize: '0.85rem', fontWeight: '700' },
  inProgressTag: { color: '#b45309', fontSize: '0.85rem', fontWeight: '700' },
  failedTag: { color: '#dc2626', fontSize: '0.85rem', fontWeight: '700' },
  newTag: { color: '#1d4ed8', fontSize: '0.85rem', fontWeight: '700', background: '#eff6ff', padding: '0.15rem 0.6rem', borderRadius: '999px' },
  cardTitle: { color: '#1e293b', fontSize: '1.08rem', fontWeight: '700', margin: 0 },
  cardMeta: { color: '#94a3b8', fontSize: '0.88rem', margin: 0 },
  openedDate: { color: '#b45309', fontSize: '0.88rem', margin: 0 },
  doneDate: { color: '#16a34a', fontSize: '0.88rem', margin: 0 },
  scoreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', marginTop: '0.25rem' },
  actionBtn: { padding: '0.7rem 1.25rem', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap' },
};
