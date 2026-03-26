const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const PasswordHistory = require('../models/PasswordHistory');
const { authenticateToken, requireRole } = require('../middleware/auth');

async function logAudit(email, action, details, ip, success = true) {
  AuditLog.create({ user_email: email, action, details, ip_address: ip, success }).catch(() => {});
}

router.use(authenticateToken, requireRole('admin'));

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email role is_active created_at last_login failed_login_attempts locked_until').sort({ created_at: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /admin/users
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!name || !email || !password || !role)
      return res.status(400).json({ error: 'Name, email, password and role are required' });

    const roles = require('../roles.json');
    if (!roles[role]) return res.status(400).json({ error: `Invalid role. Valid roles: ${Object.keys(roles).join(', ')}` });

    const strong = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password);
    if (!strong) return res.status(400).json({ error: 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const hashed = bcrypt.hashSync(password, 12);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role, must_change_password: true });
    await PasswordHistory.create({ user_id: user._id, password: hashed });

    logAudit(req.user.email, 'USER_CREATED', `Created user ${email} with role ${role}`, ip);
    res.status(201).json({ message: 'User created successfully', id: user.id });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PUT /admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { role, is_active } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role !== undefined) {
      const roles = require('../roles.json');
      if (!roles[role]) return res.status(400).json({ error: 'Invalid role' });
      await User.findByIdAndUpdate(req.params.id, { role });
      logAudit(req.user.email, 'ROLE_CHANGED', `Changed ${user.email} role to ${role}`, ip);
    }
    if (is_active !== undefined) {
      await User.findByIdAndUpdate(req.params.id, { is_active: !!is_active });
      logAudit(req.user.email, is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', `User: ${user.email}`, ip);
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ error: 'You cannot delete your own account' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.findByIdAndDelete(req.params.id);
    logAudit(req.user.email, 'USER_DELETED', `Deleted user ${user.email}`, ip);
    res.json({ message: 'User deleted successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /admin/users/:id/impersonate
router.post('/users/:id/impersonate', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'An emergency reason is required to use override access' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.is_active) return res.status(400).json({ error: 'Cannot override an inactive account' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot override your own account' });

    logAudit(req.user.email, 'EMERGENCY_OVERRIDE', `Admin "${req.user.email}" overriding as "${target.email}". Reason: ${reason.trim()}`, ip);

    const token = jwt.sign(
      { id: target.id, email: target.email, name: target.name, role: target.role, impersonatedBy: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, user: { id: target.id, email: target.email, name: target.name, role: target.role, impersonatedBy: req.user.email } });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /admin/users/:id/unlock
router.post('/users/:id/unlock', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await User.findByIdAndUpdate(req.params.id, { failed_login_attempts: 0, locked_until: null });
    logAudit(req.user.email, 'ACCOUNT_UNLOCKED', `Unlocked account: ${user.email}`, ip);
    res.json({ message: 'Account unlocked successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ created_at: -1 }).limit(200);
    res.json(logs);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /admin/roles
router.get('/roles', (req, res) => {
  res.json(require('../roles.json'));
});

module.exports = router;
