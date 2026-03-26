const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const PasswordHistory = require('../models/PasswordHistory');
const { authenticateToken } = require('../middleware/auth');

async function logAudit(email, action, details, ip, success = true) {
  AuditLog.create({ user_email: email, action, details, ip_address: ip, success }).catch(() => {});
}

async function savePasswordHistory(userId, hashedPassword) {
  await PasswordHistory.create({ user_id: userId, password: hashedPassword });
  const records = await PasswordHistory.find({ user_id: userId }).sort({ created_at: -1 });
  if (records.length > 5) {
    const toDelete = records.slice(5).map(r => r._id);
    await PasswordHistory.deleteMany({ _id: { $in: toDelete } });
  }
}

async function isPasswordReused(userId, newPassword) {
  const history = await PasswordHistory.find({ user_id: userId }).sort({ created_at: -1 }).limit(5);
  for (const h of history) {
    if (bcrypt.compareSync(newPassword, h.password)) return true;
  }
  return false;
}

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      logAudit(email, 'LOGIN_FAILED', 'User not found', ip, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      logAudit(email, 'LOGIN_FAILED', 'Account is deactivated', ip, false);
      return res.status(403).json({ error: 'Your account has been deactivated. Contact your administrator.' });
    }

    // Account locked
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 30;
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      logAudit(email, 'LOGIN_FAILED', `Account locked — ${minutesLeft} min remaining`, ip, false);
      return res.status(423).json({
        error: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
    }

    // Wrong password
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await User.findByIdAndUpdate(user._id, { failed_login_attempts: attempts, locked_until: lockedUntil });
        logAudit(email, 'ACCOUNT_LOCKED', `Locked after ${attempts} failed attempts`, ip, false);
        return res.status(423).json({
          error: `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      await User.findByIdAndUpdate(user._id, { failed_login_attempts: attempts });
      logAudit(email, 'LOGIN_FAILED', `Invalid password (attempt ${attempts}/${MAX_ATTEMPTS})`, ip, false);
      return res.status(401).json({
        error: `Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? '' : 's'} remaining before lockout.`,
      });
    }

    // Check password expiry — 90 days
    const PASSWORD_EXPIRY_DAYS = 90;
    const passwordChangedAt = new Date(user.password_changed_at || user.created_at);
    const daysSinceChange = Math.floor((Date.now() - passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24));
    const passwordExpired = daysSinceChange >= PASSWORD_EXPIRY_DAYS;

    if (passwordExpired) {
      await User.findByIdAndUpdate(user._id, { must_change_password: true });
      logAudit(email, 'PASSWORD_EXPIRED', `Password expired after ${daysSinceChange} days`, ip);
    }

    // Update last login + reset lockout
    await User.findByIdAndUpdate(user._id, {
      last_login: new Date(),
      failed_login_attempts: 0,
      locked_until: null,
    });
    logAudit(email, 'LOGIN_SUCCESS', `Logged in as ${user.role}`, ip);

    const mustChangePassword = user.must_change_password || passwordExpired;

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword,
        passwordExpired,
        daysUntilExpiry: Math.max(0, PASSWORD_EXPIRY_DAYS - daysSinceChange),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  logAudit(req.user.email, 'LOGOUT', 'User logged out', ip);
  res.json({ message: 'Logged out successfully' });
});

// POST /auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both current and new password are required' });

    const strong = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword);
    if (!strong)
      return res.status(400).json({
        error: 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character (!@#$%^&*)',
      });

    const user = await User.findById(req.user.id);

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      logAudit(req.user.email, 'PASSWORD_CHANGE_FAILED', 'Wrong current password', ip, false);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (await isPasswordReused(req.user.id, newPassword)) {
      logAudit(req.user.email, 'PASSWORD_CHANGE_FAILED', 'Password reuse attempted', ip, false);
      return res.status(400).json({ error: 'You cannot reuse any of your last 5 passwords. Please choose a different password.' });
    }

    const hashed = bcrypt.hashSync(newPassword, 12);
    await savePasswordHistory(req.user.id, user.password);
    await User.findByIdAndUpdate(req.user.id, {
      password: hashed,
      must_change_password: false,
      password_changed_at: new Date(),
    });

    logAudit(req.user.email, 'PASSWORD_CHANGED', 'Password changed — expiry reset to 90 days', ip);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/roles
router.get('/roles', authenticateToken, (req, res) => {
  res.json(require('../roles.json'));
});

// GET /auth/me
router.get('/me', authenticateToken, (req, res) => {
  const roles = require('../roles.json');
  const roleConfig = roles[req.user.role] || {};
  res.json({ ...req.user, roleConfig });
});

module.exports = router;
