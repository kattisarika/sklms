const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  first_opened_at: { type: Date, default: Date.now },
});

viewSchema.index({ user_id: 1, assignment_id: 1 }, { unique: true });

module.exports = mongoose.model('View', viewSchema);
