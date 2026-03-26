const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Material = require('../models/Material');
const Completion = require('../models/Completion');
const View = require('../models/View');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const AuditLog = require('../models/AuditLog');
const { authenticateToken } = require('../middleware/auth');

function isVisible(a, user) {
  const roles = a.target_roles || [];
  const users = a.target_users || [];
  if (roles.length === 0 && users.length === 0) return true;
  if (roles.includes(user.role)) return true;
  if (users.includes(String(user.id))) return true;
  return false;
}

async function buildCourse(a, userId) {
  const material = a.material_id?.title ? a.material_id : await Material.findById(a.material_id);
  const completion = await Completion.findOne({ user_id: userId, assignment_id: a._id });
  const view = await View.findOne({ user_id: userId, assignment_id: a._id });

  const base = {
    id: a.id,
    title: material?.title,
    type: material?.type,
    entry_point: material?.entry_point,
    file_size: material?.file_size,
    target_roles: a.target_roles,
    target_users: a.target_users,
    launched_at: a.launched_at,
    completed: !!completion,
    acknowledged_at: completion?.acknowledged_at || null,
    first_opened_at: view?.first_opened_at || null,
  };

  if (material?.type === 'quiz') {
    const quizId = material.entry_point?.replace('quiz/', '');
    const quiz = await Quiz.findById(quizId, 'pass_score');
    const latestAttempt = await QuizAttempt.findOne({ user_id: userId, assignment_id: a._id }).sort({ attempted_at: -1 });
    return { ...base, quiz_id: quizId, pass_score: quiz?.pass_score || 80, latest_attempt: latestAttempt || null };
  }
  return base;
}

// GET /api/my-courses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ is_active: true })
      .populate('material_id', 'title type entry_point file_size')
      .sort({ launched_at: -1 });

    const visible = assignments.filter(a => isVisible(a, req.user));
    const result = await Promise.all(visible.map(a => buildCourse(a, req.user.id)));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/my-courses/:assignmentId
router.get('/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.assignmentId)
      .populate('material_id', 'title type entry_point file_size');
    if (!a || !a.is_active) return res.status(404).json({ error: 'Assignment not found' });
    if (!isVisible(a, req.user)) return res.status(403).json({ error: 'Access denied' });
    const course = await buildCourse(a, req.user.id);
    res.json(course);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/my-courses/:assignmentId/open
router.post('/:assignmentId/open', authenticateToken, async (req, res) => {
  try {
    await View.findOneAndUpdate(
      { user_id: req.user.id, assignment_id: req.params.assignmentId },
      { $setOnInsert: { user_id: req.user.id, assignment_id: req.params.assignmentId, first_opened_at: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) { res.json({ ok: true }); } // ignore duplicate key errors
});

// POST /api/my-courses/:assignmentId/acknowledge
router.post('/:assignmentId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const a = await Assignment.findById(req.params.assignmentId).populate('material_id', 'title');
    if (!a || !a.is_active) return res.status(404).json({ error: 'Assignment not found' });
    if (!isVisible(a, req.user)) return res.status(403).json({ error: 'Access denied' });

    const completion = await Completion.findOneAndUpdate(
      { user_id: req.user.id, assignment_id: a._id },
      { $setOnInsert: { user_id: req.user.id, assignment_id: a._id, acknowledged_at: new Date() } },
      { upsert: true, new: true }
    );

    AuditLog.create({ user_email: req.user.email, action: 'COURSE_ACKNOWLEDGED', details: `Acknowledged: "${a.material_id?.title}"`, ip_address: ip }).catch(() => {});
    res.json({ message: 'Course acknowledged', acknowledged_at: completion.acknowledged_at });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
