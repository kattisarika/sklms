const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  acknowledged_at: { type: Date, default: Date.now },
});

completionSchema.index({ user_id: 1, assignment_id: 1 }, { unique: true });

module.exports = mongoose.model('Completion', completionSchema);
