const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs');
const Material = require('../models/Material');
const AuditLog = require('../models/AuditLog');
const Quiz = require('../models/Quiz');
const { uploadFile, uploadDirectory, deleteFile, deleteFolder, PUBLIC_URL } = require('../r2');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Multer stores uploads in a local temp folder first, then we push to R2
const TEMP_DIR = path.join(__dirname, '../uploads/temp');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.zip'].includes(ext)) cb(null, true);
    else cb(new Error('Only PDF and ZIP (SCORM) files are allowed'));
  },
});

// GET /api/materials
router.get('/', authenticateToken, async (req, res) => {
  try {
    const all = await Material.find().sort({ created_at: -1 });
    res.json(all);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/materials — admin only
router.post('/', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  const { title, type } = req.body;

  if (!req.file) return res.status(400).json({ error: 'File is required' });
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!['pdf', 'scorm'].includes(type)) return res.status(400).json({ error: 'Type must be pdf or scorm' });

  const localTempPath = req.file.path;

  try {
    let entryPoint, storedPath;

    if (type === 'pdf') {
      const r2Key = `pdf/${req.file.filename}`;
      await uploadFile(localTempPath, r2Key, 'application/pdf');
      storedPath = r2Key;
      entryPoint = `${PUBLIC_URL}/${r2Key}`;

    } else if (type === 'scorm') {
      const scormId = Date.now().toString();
      const scormLocalDir = path.join(TEMP_DIR, `scorm-${scormId}`);
      fs.mkdirSync(scormLocalDir, { recursive: true });

      // Extract ZIP locally
      const zip = new AdmZip(localTempPath);
      zip.extractAllTo(scormLocalDir, true);
      fs.unlinkSync(localTempPath);

      // Parse manifest for entry point before uploading
      let entryFile = 'index.html';
      const manifestPath = path.join(scormLocalDir, 'imsmanifest.xml');
      if (fs.existsSync(manifestPath)) {
        try {
          const xml = fs.readFileSync(manifestPath, 'utf8');
          const parsed = await xml2js.parseStringPromise(xml, { explicitArray: true });
          const resources = parsed?.manifest?.resources?.[0]?.resource || [];
          const sco = resources.find(r =>
            r.$?.['adlcp:scormtype'] === 'sco' || r.$?.['adlcp:scormType'] === 'sco'
          ) || resources[0];
          if (sco?.$.href) entryFile = sco.$.href;
        } catch {}
      }

      // Upload all extracted files to R2
      const r2Prefix = `scorm/${scormId}`;
      await uploadDirectory(scormLocalDir, r2Prefix);

      // Clean up local extracted folder
      fs.rmSync(scormLocalDir, { recursive: true, force: true });

      storedPath = r2Prefix;
      entryPoint = `${PUBLIC_URL}/${r2Prefix}/${entryFile}`;
    }

    const material = await Material.create({
      title, type,
      entry_point: entryPoint,
      stored_path: storedPath,
      file_size: req.file.size || 0,
      uploaded_by: req.user.email,
    });

    AuditLog.create({ user_email: req.user.email, action: 'MATERIAL_UPLOADED', details: `Uploaded ${type.toUpperCase()}: "${title}"`, ip_address: req.ip }).catch(() => {});
    res.status(201).json({ message: 'Material uploaded successfully', id: material.id });

  } catch (err) {
    console.error('Upload error:', err);
    if (fs.existsSync(localTempPath)) fs.unlinkSync(localTempPath);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// DELETE /api/materials/:id — admin only
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    // Delete from R2
    if (material.stored_path && !material.stored_path.startsWith('quiz/')) {
      try {
        if (material.type === 'scorm') {
          await deleteFolder(material.stored_path);
        } else {
          await deleteFile(material.stored_path);
        }
      } catch (err) { console.error('R2 deletion error:', err.message); }
    }

    // If quiz, also delete quiz document
    if (material.type === 'quiz' && material.entry_point?.startsWith('quiz/')) {
      const quizId = material.entry_point.replace('quiz/', '');
      await Quiz.findByIdAndDelete(quizId).catch(() => {});
    }

    await Material.findByIdAndDelete(req.params.id);
    AuditLog.create({ user_email: req.user.email, action: 'MATERIAL_DELETED', details: `Deleted ${material.type.toUpperCase()}: "${material.title}"`, ip_address: req.ip }).catch(() => {});
    res.json({ message: 'Material deleted successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
