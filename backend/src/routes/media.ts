import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { uploadMedia, r2Enabled } from '../services/storage';

const router = Router();

router.use(authenticate);

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Audio
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
  // Video
  'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB — WhatsApp's limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/media/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!r2Enabled) {
    return res.status(503).json({ error: 'Media storage (R2) is not configured on this server' });
  }

  try {
    const ext = path.extname(req.file.originalname) || '.' + req.file.mimetype.split('/')[1].split(';')[0];
    const filename = `uploads/${uuidv4()}${ext}`;

    const url = await uploadMedia(req.file.buffer, filename, req.file.mimetype);

    return res.json({
      url,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err: any) {
    console.error('[Media] Upload failed:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default router;
