import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';

export default function QuizViewer() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [course, setCourse] = useState(null);   // assignment + quiz_id
  const [quiz, setQuiz] = useState(null);        // questions
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/my-courses/${assignmentId}`)
      .then(res => {
        setCourse(res.data);
        return api.get(`/api/quizzes/${res.data.quiz_id}/take`);
      })
      .then(res => {
        setQuiz(res.data);
        setAnswers(new Array(res.data.questions.length).fill(null));
        // Record open
        api.post(`/api/my-courses/${assignmentId}/open`).catch(() => {});
      })
      .catch(err => setError(err.response?.data?.error || 'Quiz not found'))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  async function handleSubmit() {
    if (answers.some(a => a === null)) {
      setError('Please answer all questions before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/api/quizzes/${course.quiz_id}/submit`, {
        assignment_id: assignmentId,
        answers,
      });
      setResult(res.data);
      setSubmitted(true);
      setCurrent(0);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={styles.center}>Loading quiz...</div>;
  if (error && !quiz) return (
    <div style={styles.center}>
      <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
      <button onClick={() => navigate('/my-courses')} style={styles.backBtn}>← Back</button>
    </div>
  );

  const questions = quiz?.questions || [];
  const q = questions[current];
  const total = questions.length;
  const progress = Math.round(((current + 1) / total) * 100);

  // ── Results screen ──
  if (submitted && result) {
    return (
      <div style={styles.page}>
        <div style={styles.topBar}>
          <button onClick={() => navigate('/my-courses')} style={styles.backBtn}>← My Courses</button>
          <h2 style={styles.quizTitle}>{quiz.title}</h2>
        </div>

        <div style={styles.resultsWrap}>
          <div style={{ ...styles.scoreCard, background: result.passed ? '#f0fdf4' : '#fef2f2', borderColor: result.passed ? '#86efac' : '#fca5a5' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{result.passed ? '🎉' : '😞'}</div>
            <h2 style={{ color: result.passed ? '#16a34a' : '#dc2626', fontSize: '2rem', fontWeight: '800', margin: 0 }}>
              {result.score}%
            </h2>
            <p style={{ color: result.passed ? '#16a34a' : '#dc2626', fontWeight: '700', margin: '0.25rem 0' }}>
              {result.passed ? 'PASSED' : 'FAILED'} — {result.correct} of {result.total} correct
            </p>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Pass score: {result.pass_score}%
            </p>
            {result.passed && (
              <p style={{ color: '#16a34a', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: '600' }}>
                ✅ This quiz has been marked complete in your History.
              </p>
            )}
          </div>

          <h3 style={{ color: '#1e293b', marginBottom: '1rem' }}>Review Your Answers</h3>
          <div style={styles.reviewList}>
            {result.results.map((r, i) => (
              <div key={i} style={{ ...styles.reviewCard, borderLeft: `4px solid ${r.is_correct ? '#16a34a' : '#ef4444'}` }}>
                <div style={styles.reviewHeader}>
                  <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>Q{i + 1}. {r.question}</span>
                  <span style={{ color: r.is_correct ? '#16a34a' : '#ef4444', fontWeight: '700', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {r.is_correct ? '✅ Correct' : '❌ Wrong'}
                  </span>
                </div>
                <div style={styles.reviewOptions}>
                  {r.options.map((opt, j) => (
                    <div key={j} style={{
                      ...styles.reviewOption,
                      background: j === r.correct_index ? '#dcfce7' : j === r.selected && !r.is_correct ? '#fee2e2' : '#f8fafc',
                      color: j === r.correct_index ? '#15803d' : j === r.selected && !r.is_correct ? '#b91c1c' : '#64748b',
                      fontWeight: j === r.correct_index || j === r.selected ? '600' : '400',
                    }}>
                      {j === r.correct_index && '✓ '}
                      {j === r.selected && j !== r.correct_index && '✗ '}
                      {String.fromCharCode(65 + j)}. {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.resultActions}>
            <button onClick={() => navigate('/my-courses')} style={styles.primaryBtn}>
              ← Back to My Courses
            </button>
            {!result.passed && (
              <button onClick={() => { setSubmitted(false); setAnswers(new Array(total).fill(null)); setCurrent(0); setResult(null); }} style={styles.retakeBtn}>
                🔄 Retake Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz taking screen ──
  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <button onClick={() => navigate('/my-courses')} style={styles.backBtn}>← My Courses</button>
        <h2 style={styles.quizTitle}>{quiz?.title}</h2>
        <span style={styles.qCounter}>Question {current + 1} of {total}</span>
      </div>

      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>

      <div style={styles.quizBody}>
        <div style={styles.questionCard}>
          <p style={styles.qNum}>Question {current + 1} of {total}</p>
          <h3 style={styles.qText}>{q.question}</h3>

          <div style={styles.optionList}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  const updated = [...answers];
                  updated[current] = i;
                  setAnswers(updated);
                }}
                style={{
                  ...styles.option,
                  background: answers[current] === i ? '#1e40af' : 'white',
                  color: answers[current] === i ? 'white' : '#374151',
                  borderColor: answers[current] === i ? '#1e40af' : '#e2e8f0',
                  transform: answers[current] === i ? 'scale(1.01)' : 'scale(1)',
                }}
              >
                <span style={{ ...styles.optionLetter, background: answers[current] === i ? 'rgba(255,255,255,0.2)' : '#f1f5f9' }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            ))}
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
        </div>

        {/* Navigation */}
        <div style={styles.navRow}>
          <button onClick={() => setCurrent(c => c - 1)} disabled={current === 0} style={styles.navBtn}>
            ← Previous
          </button>

          <div style={styles.dotRow}>
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} style={{
                ...styles.dot,
                background: answers[i] !== null ? '#1e40af' : '#e2e8f0',
                width: i === current ? '24px' : '10px',
              }} />
            ))}
          </div>

          {current < total - 1 ? (
            <button onClick={() => setCurrent(c => c + 1)} style={styles.nextBtn}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={styles.submitBtn}>
              {submitting ? 'Submitting...' : '✅ Submit Quiz'}
            </button>
          )}
        </div>

        <p style={styles.answeredNote}>
          {answers.filter(a => a !== null).length} of {total} answered
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', background: '#f8fafc' },
  center: { textAlign: 'center', padding: '4rem', color: '#64748b' },
  topBar: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem', background: 'white', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' },
  backBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: '#64748b', fontSize: '0.85rem' },
  quizTitle: { color: '#1e293b', fontSize: '1rem', fontWeight: '700', margin: 0, flex: 1 },
  qCounter: { color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  progressTrack: { height: '4px', background: '#e2e8f0' },
  progressFill: { height: '100%', background: '#1e40af', transition: 'width 0.3s ease' },
  quizBody: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', gap: '1.5rem' },
  questionCard: { background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '680px', width: '100%', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  qNum: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' },
  qText: { color: '#1e293b', fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', lineHeight: '1.5' },
  optionList: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  option: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', border: '2px solid', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem', transition: 'all 0.15s', fontWeight: '500' },
  optionLetter: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 },
  navRow: { display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '680px', width: '100%', justifyContent: 'space-between' },
  navBtn: { padding: '0.6rem 1.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' },
  nextBtn: { padding: '0.6rem 1.25rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' },
  submitBtn: { padding: '0.6rem 1.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem' },
  dotRow: { display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', flex: 1 },
  dot: { height: '10px', borderRadius: '999px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 },
  answeredNote: { color: '#94a3b8', fontSize: '0.8rem' },
  // Results
  resultsWrap: { padding: '2rem', maxWidth: '700px', margin: '0 auto', width: '100%' },
  scoreCard: { border: '2px solid', borderRadius: '16px', padding: '2rem', textAlign: 'center', marginBottom: '2rem' },
  reviewList: { display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' },
  reviewCard: { background: 'white', borderRadius: '10px', padding: '1rem 1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
  reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' },
  reviewOptions: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  reviewOption: { padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' },
  resultActions: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  primaryBtn: { padding: '0.75rem 1.5rem', background: '#1e40af', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
  retakeBtn: { padding: '0.75rem 1.5rem', background: 'white', color: '#7c3aed', border: '2px solid #7c3aed', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
};
