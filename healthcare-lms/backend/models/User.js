const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  must_change_password: { type: Boolean, default: false },
  password_changed_at: { type: Date, default: Date.now },
  last_login: { type: Date },
  failed_login_attempts: { type: Number, default: 0 },
  locked_until: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('User', userSchema);
