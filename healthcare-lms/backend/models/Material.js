const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },   // 'pdf' | 'scorm' | 'quiz'
  entry_point: String,
  stored_path: String,
  file_size: { type: Number, default: 0 },
  uploaded_by: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Material', materialSchema);
