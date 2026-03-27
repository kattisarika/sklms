const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Material = require('../models/Material');
const Completion = require('../models/Completion');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');

async function logAudit(email, action, details, ip) {
  AuditLog.create({ user_email: email, action, details, ip_address: ip }).catch(() => {});
}

// GET /api/assignments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ is_active: true })
      .populate('material_id', 'title type entry_point file_size')
      .sort({ launched_at: -1 });

    const result = await Promise.all(assignments.map(async a => {
      const completions_count = await Completion.countDocuments({ assignment_id: a._id });
      return {
        id: a.id,
        material_id: a.material_id?._id,
        title: a.material_id?.title,
        type: a.material_id?.type,
        entry_point: a.material_id?.entry_point,
        file_size: a.material_id?.file_size,
        target_roles: a.target_roles,
        target_users: a.target_users,
        launched_by: a.launched_by,
        launched_at: a.launched_at,
        is_active: a.is_active,
        completions_count,
      };
    }));

    if (req.user.role === 'admin') return res.json(result);

    const visible = result.filter(a => {
      if (a.target_roles.length === 0 && a.target_users.length === 0) return true;
      if (a.target_roles.includes(req.user.role)) return true;
      if (a.target_users.includes(String(req.user.id))) return true;
      return false;
    });
    res.json(visible);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/assignments
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { material_id, target_roles = [], target_users = [] } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!material_id) return res.status(400).json({ error: 'Course is required' });

    const material = await Material.findById(material_id);
    if (!material) return res.status(404).json({ error: 'Course not found' });

    // Expand roles → snapshot current user IDs so future new users don't inherit this assignment
    const roles = Array.isArray(target_roles) ? target_roles : [];
    const explicitUsers = Array.isArray(target_users) ? target_users : [];
    let expandedUsers = [...explicitUsers];
    if (roles.length > 0) {
      const roleUsers = await User.find({ role: { $in: roles }, is_active: true }, '_id');
      roleUsers.forEach(u => {
        const uid = u._id.toString();
        if (!expandedUsers.includes(uid)) expandedUsers.push(uid);
      });
    }

    const assignment = await Assignment.create({
      material_id,
      target_roles: roles,       // kept for display in admin panel
      target_users: expandedUsers,
      launched_by: req.user.email,
    });

    logAudit(req.user.email, 'COURSE_LAUNCHED',
      `Launched "${material.title}" → roles: [${target_roles.join(', ')}] users: [${target_users.join(', ')}]`, ip);

    res.status(201).json({ message: 'Course launched successfully', id: assignment.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('material_id', 'title');
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    await Assignment.findByIdAndUpdate(req.params.id, { is_active: false });
    logAudit(req.user.email, 'COURSE_REVOKED', `Revoked "${assignment.material_id?.title}"`, req.ip);
    res.json({ message: 'Assignment revoked successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
