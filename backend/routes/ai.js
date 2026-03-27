const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticateToken } = require('../middleware/auth');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache fetched PDFs in memory so we don't re-download per message
const pdfCache = new Map();

async function fetchPdfAsBase64(url) {
  if (pdfCache.has(url)) return pdfCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = res.headers.get('content-type') || 'application/pdf';
  const result = { base64, mimeType };
  pdfCache.set(url, result);
  return result;
}

// POST /api/ai/ask
router.post('/ask', authenticateToken, async (req, res) => {
  try {
    const { question, courseTitle, contentUrl, history } = req.body;

    if (!question) return res.status(400).json({ error: 'Question is required' });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const parts = [];

    // Try to include the PDF as context
    if (contentUrl) {
      try {
        const { base64, mimeType } = await fetchPdfAsBase64(contentUrl);
        parts.push({
          inlineData: { data: base64, mimeType },
        });
      } catch (e) {
        console.warn('Could not fetch PDF for AI context:', e.message);
      }
    }

    // Build system context
    const systemPrompt = `You are a helpful AI teaching assistant for a healthcare training platform. The learner is currently studying the course "${courseTitle || 'Unknown'}". Answer their questions about the course material clearly and concisely. If the course PDF is provided, use it as your primary reference. Keep answers focused and relevant to healthcare education.`;

    // Build conversation history
    const contents = [];

    // Add prior messages if any
    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      }
    }

    // Add the current question with PDF context on the first message
    const userParts = [];
    if (parts.length > 0 && (!history || history.length === 0)) {
      userParts.push(...parts);
    }
    userParts.push({ text: `${systemPrompt}\n\nQuestion: ${question}` });

    contents.push({ role: 'user', parts: userParts });

    const result = await model.generateContent({ contents });
    const answer = result.response.text();

    res.json({ answer });
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Cache for extracted PDF text
const pdfTextCache = new Map();

// GET /api/ai/pdf-text?url=...
router.get('/pdf-text', authenticateToken, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url is required' });

    if (pdfTextCache.has(url)) return res.json({ text: pdfTextCache.get(url) });

    const pdfParse = require('pdf-parse');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const text = parsed.text.substring(0, 30000); // Limit to ~30k chars
    pdfTextCache.set(url, text);
    res.json({ text });
  } catch (err) {
    console.error('PDF text extraction error:', err);
    res.status(500).json({ error: 'Failed to extract PDF text' });
  }
});

// GET /api/ai/pdf-proxy?url=... — proxy PDF to avoid CORS issues with react-pdf
router.get('/pdf-proxy', authenticateToken, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('PDF proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch PDF' });
  }
});

// POST /api/ai/ask-history — answers questions based on user's completed courses
router.post('/ask-history', authenticateToken, async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const Assignment = require('../models/Assignment');
    const Completion = require('../models/Completion');

    // Get user's completed assignments
    const completions = await Completion.find({ user_id: req.user.id });
    const assignmentIds = completions.map(c => c.assignment_id);
    const assignments = await Assignment.find({
      _id: { $in: assignmentIds }, is_active: true,
    }).populate('material_id', 'title type entry_point');

    const pdfCourses = assignments
      .filter(a => a.material_id?.type === 'pdf' && a.material_id?.entry_point)
      .map(a => ({ title: a.material_id.title, url: a.material_id.entry_point }));

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const pdfParts = [];
    const loadedTitles = [];

    for (const course of pdfCourses) {
      try {
        const { base64, mimeType } = await fetchPdfAsBase64(course.url);
        pdfParts.push({ inlineData: { data: base64, mimeType } });
        loadedTitles.push(course.title);
      } catch (e) {
        console.warn(`Could not load PDF "${course.title}":`, e.message);
      }
    }

    const systemPrompt = `You are a helpful AI teaching assistant for a healthcare training platform.
The learner has completed these courses: ${loadedTitles.length > 0 ? loadedTitles.join(', ') : 'none yet'}.
${pdfParts.length > 0 ? 'The course PDFs are attached. Use them as your primary reference to answer the question.' : 'Answer based on general healthcare knowledge.'}
Be clear, concise, and grounded in the course material.`;

    const contents = [];
    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
      }
    }

    const userParts = [];
    if (pdfParts.length > 0 && (!history || history.length === 0)) {
      userParts.push(...pdfParts);
    }
    userParts.push({ text: `${systemPrompt}\n\nQuestion: ${question}` });
    contents.push({ role: 'user', parts: userParts });

    const result = await model.generateContent({ contents });
    res.json({ answer: result.response.text(), courses: loadedTitles });
  } catch (err) {
    console.error('AI ask-history error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
