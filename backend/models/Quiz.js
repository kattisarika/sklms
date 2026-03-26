const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  pass_score: { type: Number, default: 80 },
  created_by: String,
  questions: [{
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correct_index: { type: Number, required: true },
    order_index: { type: Number, default: 0 },
  }],
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Quiz', quizSchema);
