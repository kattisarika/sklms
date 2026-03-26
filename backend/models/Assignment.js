const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  target_roles: { type: [String], default: [] },
  target_users: { type: [String], default: [] },   // array of User ID strings
  launched_by: String,
  is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'launched_at', updatedAt: false } });

module.exports = mongoose.model('Assignment', assignmentSchema);
