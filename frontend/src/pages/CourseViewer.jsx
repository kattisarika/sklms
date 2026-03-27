import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import PdfViewer, { extractPageText } from '../components/PdfViewer';
import AskDoubtPanel from '../components/AskDoubtPanel';

export default function CourseViewer() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState('');
  const [error, setError] = useState('');
  const [doubtPanelOpen, setDoubtPanelOpen] = useState(false);

  const canvasRef = useRef(null);
  const pageContainerRef = useRef(null);
  const currentPageRef = useRef(1);

  // Use ref for current page to avoid re-rendering PdfViewer
  const handlePageChange = useCallback((page) => {
    currentPageRef.current = page;
  }, []);

  useEffect(() => {
    api.get(`/api/my-courses/${assignmentId}`)
      .then(res => {
        setCourse(res.data);
        api.post(`/api/my-courses/${assignmentId}/open`).catch(() => {});
      })
      .catch(err => setError(err.response?.data?.error || 'Course not found'))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  async function handleAcknowledge(andExit = false) {
    setAckError('');
    setAckLoading(true);
    try {
      const res = await api.post(`/api/my-courses/${assignmentId}/acknowledge`);
      setCourse(prev => ({ ...prev, completed: true, acknowledged_at: res.data.acknowledged_at }));
      if (andExit) navigate('/my-courses');
    } catch (err) {
      setAckError(err.response?.data?.error || 'Failed to save acknowledgement');
    } finally {
      setAckLoading(false);
    }
  }

  const getPageContext = useCallback(() => {
    let imageBase64 = null;
    if (canvasRef.current) {
      try {
        const raw = canvasRef.current.toDataURL('image/jpeg', 0.7);
        imageBase64 = raw.split(',')[1];
      } catch (e) {
        console.warn('Could not capture page screenshot:', e);
      }
    }
    const pageText = extractPageText(pageContainerRef);
    return { imageBase64, pageText, pageNumber: currentPageRef.current };
  }, []);

  if (loading) return <div style={styles.center}>Loading course...</div>;
  if (error) return (
    <div style={styles.center}>
      <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
      <button onClick={() => navigate('/my-courses')} style={styles.backBtn}>← Back to My Courses</button>
    </div>
  );

  const contentUrl = course.entry_point;
  const isPdf = course.type === 'pdf';
  const isVideo = course.type === 'video';

  function toEmbedUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
        return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
      }
      if (u.hostname === 'youtu.be') {
        return `https://www.youtube.com/embed${u.pathname}`;
      }
    } catch {}
    return url;
  }

  return (
    <div style={styles.page}>
      {/* Header bar */}
      <div style={styles.topBar}>
        <button onClick={() => navigate('/my-courses')} style={styles.backBtn}>← My Courses</button>
        <div style={styles.courseInfo}>
          <span style={{ ...styles.typeBadge, background: isPdf ? '#dbeafe' : isVideo ? '#fef9c3' : '#ede9fe', color: isPdf ? '#1d4ed8' : isVideo ? '#b45309' : '#6d28d9' }}>
            {isPdf ? '📄 PDF' : isVideo ? '🎬 Video' : '📦 SCORM'}
          </span>
          <h2 style={styles.courseTitle}>{course.title}</h2>
        </div>
        {course.completed && (
          <span style={styles.completedBadge}>✅ Acknowledged</span>
        )}
      </div>

      {/* Content area: PDF viewer + optional doubt panel side by side */}
      <div style={styles.contentArea}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isPdf ? (
            <PdfViewer
              url={contentUrl}
              onPageChange={handlePageChange}
              canvasRef={canvasRef}
              pageContainerRef={pageContainerRef}
              toolbarExtra={
                !doubtPanelOpen && (
                  <button onClick={() => setDoubtPanelOpen(true)} style={styles.askDoubtBtn}>
                    💬 Ask Doubt
                  </button>
                )
              }
            />
          ) : isVideo ? (
            <iframe
              src={toEmbedUrl(contentUrl)}
              title={course.title}
              style={styles.frame}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <iframe
              src={contentUrl}
              title={course.title}
              style={styles.frame}
              allowFullScreen
            />
          )}
        </div>

        {doubtPanelOpen && isPdf && (
          <AskDoubtPanel
            courseTitle={course.title}
            onClose={() => setDoubtPanelOpen(false)}
            getPageContext={getPageContext}
          />
        )}
      </div>

      {/* Acknowledge / Exit bar */}
      <div style={{ ...styles.ackBar, background: course.completed ? '#f0fdf4' : '#1e293b' }}>
        {course.completed ? (
          <div style={styles.ackDone}>
            <span style={styles.ackCheck}>✅</span>
            <div style={{ flex: 1 }}>
              <p style={styles.ackDoneTitle}>You have completed this course</p>
              <p style={styles.ackDoneDate}>
                Completed on {new Date(course.acknowledged_at).toLocaleString()}
              </p>
            </div>
            <button onClick={() => navigate('/my-courses')} style={styles.exitBtn}>
              ← Exit
            </button>
          </div>
        ) : isPdf && !isVideo ? (
          <div style={styles.ackPending}>
            <p style={styles.ackInstruction}>
              Please review the entire course above, then click the button to confirm you have read and understood the material.
            </p>
            <div style={styles.ackActions}>
              {ackError && <p style={styles.ackError}>{ackError}</p>}
              <button
                onClick={() => handleAcknowledge(false)}
                disabled={ackLoading}
                style={styles.ackBtn}
              >
                {ackLoading ? 'Saving...' : '✅ I Acknowledge I Have Reviewed This Course'}
              </button>
            </div>
          </div>
        ) : (
          /* SCORM: Exit & Complete button */
          <div style={styles.ackPending}>
            <p style={styles.ackInstruction}>
              When you have finished reviewing the course, click Exit to mark it as complete.
            </p>
            <div style={styles.ackActions}>
              {ackError && <p style={styles.ackError}>{ackError}</p>}
              <button
                onClick={() => handleAcknowledge(true)}
                disabled={ackLoading}
                style={styles.exitCompleteBtn}
              >
                {ackLoading ? 'Saving...' : '✅ Exit & Complete Course'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' },
  center: { textAlign: 'center', padding: '4rem', color: '#64748b' },
  topBar: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '0.75rem 1.5rem', background: 'white',
    borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap',
  },
  backBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.4rem 0.85rem', cursor: 'pointer', color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  courseInfo: { display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 },
  typeBadge: { padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' },
  courseTitle: { color: '#1e293b', fontSize: '1rem', fontWeight: '700', margin: 0 },
  completedBadge: { color: '#16a34a', fontWeight: '700', fontSize: '0.875rem', whiteSpace: 'nowrap' },
  contentArea: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', background: '#f1f5f9' },
  frame: { width: '100%', height: '100%', border: 'none', display: 'block' },
  askDoubtBtn: {
    padding: '0.4rem 1rem',
    background: 'linear-gradient(135deg, #1e40af, #7c3aed)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  ackBar: {
    flexShrink: 0, padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
  },
  ackDone: { display: 'flex', alignItems: 'center', gap: '1rem' },
  ackCheck: { fontSize: '2rem' },
  ackDoneTitle: { color: '#15803d', fontWeight: '700', margin: 0, fontSize: '0.95rem' },
  ackDoneDate: { color: '#16a34a', fontSize: '0.8rem', margin: 0 },
  ackPending: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap' },
  ackInstruction: { color: '#94a3b8', fontSize: '0.85rem', margin: 0, flex: 1 },
  ackActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' },
  ackError: { color: '#f87171', fontSize: '0.8rem', margin: 0 },
  ackBtn: {
    padding: '0.75rem 1.75rem', background: '#16a34a', color: 'white',
    border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer',
    fontSize: '0.9rem', whiteSpace: 'nowrap',
  },
  exitCompleteBtn: {
    padding: '0.75rem 1.75rem', background: '#7c3aed', color: 'white',
    border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer',
    fontSize: '0.9rem', whiteSpace: 'nowrap',
  },
  exitBtn: {
    padding: '0.5rem 1.25rem', background: 'white', color: '#15803d',
    border: '2px solid #16a34a', borderRadius: '8px', fontWeight: '700',
    cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap',
  },
};
