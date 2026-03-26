const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Material = require('../models/Material');
const Completion = require('../models/Completion');
const View = require('../models/View');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/quizzes — admin
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const quizzes = await Quiz.find().sort({ created_at: -1 });
    res.json(quizzes.map(q => ({ ...q.toObject(), question_count: q.questions.length })));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/quizzes — admin: create quiz + material record
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, pass_score = 80, questions } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!questions || questions.length < 1) return res.status(400).json({ error: 'At least 1 question is required' });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question?.trim()) return res.status(400).json({ error: `Question ${i + 1}: text is required` });
      if (!q.options || q.options.length !== 4 || q.options.some(o => !o?.trim()))
        return res.status(400).json({ error: `Question ${i + 1}: all 4 options are required` });
      if (q.correct_index === undefined || q.correct_index < 0 || q.correct_index > 3)
        return res.status(400).json({ error: `Question ${i + 1}: please select the correct answer` });
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      pass_score,
      created_by: req.user.email,
      questions: questions.map((q, i) => ({
        question: q.question.trim(),
        options: q.options,
        correct_index: q.correct_index,
        order_index: i,
      })),
    });

    const material = await Material.create({
      title: title.trim(), type: 'quiz',
      entry_point: `quiz/${quiz.id}`, stored_path: `quiz/${quiz.id}`,
      file_size: 0, uploaded_by: req.user.email,
    });

    AuditLog.create({ user_email: req.user.email, action: 'QUIZ_CREATED', details: `Created quiz: "${title}" (${questions.length} questions, pass ≥${pass_score}%)`, ip_address: ip }).catch(() => {});
    res.status(201).json({ message: 'Quiz created', quiz_id: quiz.id, material_id: material.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/quizzes/:id — admin: full quiz with correct answers
router.get('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(quiz);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/quizzes/:id — admin
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const ip = req.ip || req.connection.remoteAddress;

    await Material.deleteOne({ entry_point: `quiz/${req.params.id}` });
    await Quiz.findByIdAndDelete(req.params.id);

    AuditLog.create({ user_email: req.user.email, action: 'QUIZ_DELETED', details: `Deleted quiz: "${quiz.title}"`, ip_address: ip }).catch(() => {});
    res.json({ message: 'Quiz deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/quizzes/:id/take — learner: questions WITHOUT correct answers
router.get('/:id/take', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id, 'id title pass_score questions');
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const sanitized = {
      id: quiz.id,
      title: quiz.title,
      pass_score: quiz.pass_score,
      questions: quiz.questions
        .sort((a, b) => a.order_index - b.order_index)
        .map(q => ({ id: q._id, question: q.question, options: q.options, order_index: q.order_index })),
    };
    res.json(sanitized);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/quizzes/:id/submit — learner
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { assignment_id, answers } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const questions = quiz.questions.sort((a, b) => a.order_index - b.order_index);
    if (!answers || answers.length !== questions.length)
      return res.status(400).json({ error: 'Please answer all questions before submitting' });

    let correct = 0;
    const results = questions.map((q, i) => {
      const isCorrect = Number(answers[i]) === q.correct_index;
      if (isCorrect) correct++;
      return { question: q.question, options: q.options, selected: Number(answers[i]), correct_index: q.correct_index, is_correct: isCorrect };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.pass_score;

    await QuizAttempt.create({ user_id: req.user.id, assignment_id, quiz_id: quiz._id, score, passed, answers });

    // Record open
    await View.findOneAndUpdate(
      { user_id: req.user.id, assignment_id },
      { $setOnInsert: { user_id: req.user.id, assignment_id, first_opened_at: new Date() } },
      { upsert: true }
    ).catch(() => {});

    // Auto-acknowledge on pass
    if (passed) {
      await Completion.findOneAndUpdate(
        { user_id: req.user.id, assignment_id },
        { $setOnInsert: { user_id: req.user.id, assignment_id, acknowledged_at: new Date() } },
        { upsert: true }
      ).catch(() => {});
    }

    AuditLog.create({ user_email: req.user.email, action: passed ? 'QUIZ_PASSED' : 'QUIZ_FAILED', details: `"${quiz.title}" — ${score}% (${correct}/${questions.length}) ${passed ? 'PASSED' : 'FAILED'}`, ip_address: ip }).catch(() => {});
    res.json({ score, passed, correct, total: questions.length, pass_score: quiz.pass_score, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
