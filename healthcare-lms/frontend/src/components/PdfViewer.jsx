import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import api from '../api/axios';

const PDFJS_CDN = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/build/pdf.worker.min.mjs`;

export function extractPageText(containerRef) {
  if (!containerRef?.current) return '';
  const textLayer = containerRef.current.querySelector('.react-pdf__Page__textContent');
  if (!textLayer) return '';
  return (textLayer.textContent || '').substring(0, 500);
}

export default function PdfViewer({ url, onPageChange, canvasRef, pageContainerRef, toolbarExtra }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pageInput, setPageInput] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  const scrollRef = useRef(null);
  const onPageChangeRef = useRef(onPageChange);

  // pdfjs-dist v5 options: provide WASM, cMap, and font paths so JPEG2000/JBIG2 images decode
  const pdfOptions = useMemo(() => ({
    cMapUrl: `${PDFJS_CDN}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_CDN}/standard_fonts/`,
    wasmUrl: `${PDFJS_CDN}/wasm/`,
  }), []);

  // Keep ref in sync so we don't re-trigger effects
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  // Fetch PDF through backend proxy to avoid CORS issues — runs once per URL
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfBytes(null);
    api.get('/api/ai/pdf-proxy', { params: { url }, responseType: 'arraybuffer' })
      .then(res => {
        if (!cancelled) setPdfBytes(res.data);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('PDF proxy fetch error:', err);
          setError('Failed to load PDF');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [url]);

  // Stable file object — only recreated when the raw bytes change
  const pdfFile = useMemo(() => {
    if (!pdfBytes) return null;
    return { data: new Uint8Array(pdfBytes) };
  }, [pdfBytes]);

  // Notify parent of page changes via ref (no re-render loop)
  useEffect(() => {
    if (onPageChangeRef.current) onPageChangeRef.current(pageNumber);
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => {
    setNumPages(n);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    console.error('PDF load error:', err);
    setError('Failed to load PDF');
    setLoading(false);
  }, []);

  function goToPage(n) {
    const p = Math.max(1, Math.min(numPages || 1, n));
    setPageNumber(p);
  }

  function handlePageInputSubmit() {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goToPage(n);
    else setPageInput(String(pageNumber));
  }

  function zoomIn() {
    setScale(s => Math.min(3, +(s + 0.25).toFixed(2)));
  }

  function zoomOut() {
    setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)));
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolGroup}>
          <button onClick={zoomOut} style={styles.toolBtn} title="Zoom out">-</button>
          <span style={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} style={styles.toolBtn} title="Zoom in">+</button>
        </div>

        <div style={styles.divider} />

        <div style={styles.toolGroup}>
          <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} style={styles.toolBtn}>
            Prev
          </button>
          <span style={styles.pageInfo}>
            Page{' '}
            <input
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              onBlur={handlePageInputSubmit}
              onKeyDown={e => e.key === 'Enter' && handlePageInputSubmit()}
              style={styles.pageInput}
            />
            {' '}of {numPages || '...'}
          </span>
          <button onClick={() => goToPage(pageNumber + 1)} disabled={!numPages || pageNumber >= numPages} style={styles.toolBtn}>
            Next
          </button>
        </div>

        {toolbarExtra && <div style={{ marginLeft: 'auto' }}>{toolbarExtra}</div>}
      </div>

      {/* PDF Render Area */}
      <div ref={scrollRef} style={styles.scrollArea}>
        {error && <p style={styles.error}>{error}</p>}
        {!pdfFile && !error && <p style={styles.loadingText}>Loading PDF...</p>}
        {pdfFile && (
          <Document
            file={pdfFile}
            options={pdfOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<p style={styles.loadingText}>Loading PDF...</p>}
          >
            <div ref={pageContainerRef}>
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                canvasRef={canvasRef}
              />
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#f1f5f9',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 1rem',
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  toolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  toolBtn: {
    padding: '0.3rem 0.7rem',
    background: '#f1f5f9',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
  },
  zoomLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
    minWidth: '40px',
    textAlign: 'center',
  },
  divider: {
    width: '1px',
    height: '20px',
    background: '#d1d5db',
  },
  pageInfo: {
    fontSize: '0.8rem',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  pageInput: {
    width: '40px',
    textAlign: 'center',
    padding: '0.2rem 0.3rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '0.8rem',
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'center',
    padding: '1rem',
  },
  loadingText: {
    color: '#64748b',
    textAlign: 'center',
    padding: '2rem',
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    padding: '2rem',
  },
};
