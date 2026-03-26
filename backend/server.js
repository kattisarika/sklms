require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();

// Ensure all Mongoose documents include `id` (string) in JSON responses
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_, ret) => {
    if (ret._id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());

// Serve built React frontend in production
const DIST_PATH = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
}

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/my-courses', require('./routes/learner'));
app.use('/api/quizzes', require('./routes/quizzes'));
app.use('/api/ai', require('./routes/ai'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Catch-all: serve React app for any non-API route
if (fs.existsSync(DIST_PATH)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// Seed default admin if no users exist
async function seedAdmin() {
  const User = require('./models/User');
  const PasswordHistory = require('./models/PasswordHistory');
  const count = await User.countDocuments();
  if (count === 0) {
    const hashedPassword = bcrypt.hashSync('Admin@12345', 12);
    const admin = await User.create({
      name: 'Administrator',
      email: 'admin@hospital.com',
      password: hashedPassword,
      role: 'admin',
      must_change_password: true,
    });
    await PasswordHistory.create({ user_id: admin._id, password: hashedPassword });
    console.log('');
    console.log('========================================');
    console.log('  Default Admin Account Created');
    console.log('  Email:    admin@hospital.com');
    console.log('  Password: Admin@12345');
    console.log('  ⚠️  Change password after first login');
    console.log('========================================');
    console.log('');
  }
}

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_lms';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedAdmin();
    app.listen(PORT, () => {
      console.log(`Healthcare Portal backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
