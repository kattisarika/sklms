const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_email: String,
  action: { type: String, required: true },
  details: String,
  ip_address: String,
  success: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('AuditLog', auditLogSchema);
