const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  quiz_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  score: { type: Number, required: true },
  passed: { type: Boolean, default: false },
  answers: [Number],
}, { timestamps: { createdAt: 'attempted_at', updatedAt: false } });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
