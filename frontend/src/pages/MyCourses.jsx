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
        {tab === 'New Content'     && <CourseList items={newContent} tab="new" navigate={navigate} />}
        {tab === 'Incomplete'      && <CourseList items={incomplete} tab="incomplete" navigate={navigate} />}
        {tab === 'History'         && <CourseList items={history} tab="history" navigate={navigate} />}
        {tab === 'Quiz'            && <QuizList items={quizzes} navigate={navigate} />}
        {tab === 'Ask a Question'  && <AskQuestion completedCourses={history} />}
      </div>
    </div>
  );
}

function CourseList({ items, tab, navigate }) {
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

  return (
    <div style={styles.grid}>
      {items.map(course => (
        <div key={course.id} style={{ ...styles.card, borderLeft: `4px solid ${tab === 'history' ? '#16a34a' : tab === 'incomplete' ? '#f59e0b' : '#1e40af'}` }}>
          <div style={styles.cardTop}>
            <span style={{ ...styles.typeBadge, background: course.type === 'pdf' ? '#dbeafe' : '#ede9fe', color: course.type === 'pdf' ? '#1d4ed8' : '#6d28d9' }}>
              {course.type === 'pdf' ? '📄 PDF' : '📦 SCORM'}
            </span>
            {tab === 'history' && <span style={styles.completedTag}>✅ Done</span>}
            {tab === 'incomplete' && <span style={styles.inProgressTag}>⏳ In Progress</span>}
          </div>

          <h3 style={styles.cardTitle}>{course.title}</h3>
          <p style={styles.cardMeta}>Assigned {new Date(course.launched_at).toLocaleDateString()}</p>

          {tab === 'incomplete' && course.first_opened_at && (
            <p style={styles.openedDate}>Opened {new Date(course.first_opened_at).toLocaleDateString()}</p>
          )}
          {tab === 'history' && course.acknowledged_at && (
            <p style={styles.doneDate}>Completed {new Date(course.acknowledged_at).toLocaleString()}</p>
          )}

          <button
            onClick={() => navigate(`/my-courses/${course.id}`)}
            style={{ ...styles.actionBtn, background: tab === 'history' ? '#16a34a' : tab === 'incomplete' ? '#f59e0b' : '#1e40af' }}
          >
            {tab === 'history' ? '↩ Review Again' : tab === 'incomplete' ? '▶ Continue' : '▶ Start Course'}
          </button>
        </div>
      ))}
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
  wrapper: { display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', height: '70vh' },
  contextBar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.85rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  contextLabel: { color: '#374151', fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  noContext: { color: '#94a3b8', fontSize: '0.82rem' },
  courseChip: { padding: '0.2rem 0.65rem', background: '#dbeafe', color: '#1d4ed8', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '600' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#f8fafc' },
  emptyState: { margin: 'auto', textAlign: 'center', padding: '2rem' },
  rowRight: { display: 'flex', justifyContent: 'flex-end' },
  rowLeft: { display: 'flex', justifyContent: 'flex-start' },
  bubbleUser: { maxWidth: '72%', padding: '0.75rem 1rem', background: '#1e40af', color: 'white', borderRadius: '14px 14px 4px 14px' },
  bubbleAi: { maxWidth: '80%', padding: '0.75rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px 14px 14px 4px', whiteSpace: 'pre-wrap' },
  bubbleLabel: { fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', opacity: 0.7 },
  bubbleText: { fontSize: '0.92rem', lineHeight: 1.6 },
  inputRow: { padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', background: 'white', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  errorMsg: { color: '#dc2626', fontSize: '0.82rem', margin: 0 },
  inputWrap: { display: 'flex', gap: '0.75rem' },
  input: { flex: 1, padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', outline: 'none' },
  sendBtn: { padding: '0.75rem 1.5rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem', whiteSpace: 'nowrap' },
};

const styles = {
  page: { padding: '2rem', maxWidth: '1100px', margin: '0 auto' },
  center: { textAlign: 'center', padding: '4rem', color: '#64748b' },
  pageHeader: { marginBottom: '1.5rem' },
  title: { color: '#1e293b', fontSize: '1.5rem', margin: 0 },
  sub: { color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' },
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  tab: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' },
  activeTab: { background: '#1e40af', color: 'white', borderColor: '#1e40af' },
  badge: { padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700' },
  content: {},
  empty: { textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' },
  card: { background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '600' },
  completedTag: { color: '#16a34a', fontSize: '0.75rem', fontWeight: '700' },
  inProgressTag: { color: '#b45309', fontSize: '0.75rem', fontWeight: '700' },
  failedTag: { color: '#dc2626', fontSize: '0.75rem', fontWeight: '700' },
  newTag: { color: '#1d4ed8', fontSize: '0.75rem', fontWeight: '700', background: '#eff6ff', padding: '0.1rem 0.5rem', borderRadius: '999px' },
  cardTitle: { color: '#1e293b', fontSize: '0.95rem', fontWeight: '700', margin: 0 },
  cardMeta: { color: '#94a3b8', fontSize: '0.78rem', margin: 0 },
  openedDate: { color: '#b45309', fontSize: '0.78rem', margin: 0 },
  doneDate: { color: '#16a34a', fontSize: '0.78rem', margin: 0 },
  scoreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: '8px', marginTop: '0.25rem' },
  actionBtn: { marginTop: '0.5rem', padding: '0.6rem 1rem', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' },
};
