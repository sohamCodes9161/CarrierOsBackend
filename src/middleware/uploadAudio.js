import multer from 'multer';
import { BadRequestError } from '../errors/AppError.js';

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg', // mp3
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
]);

const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15MB - generous for a few minutes of spoken answer

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
    return cb(new BadRequestError(`Unsupported audio format: ${file.mimetype}`));
  }
  cb(null, true);
}

export const uploadAudioAnswer = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AUDIO_SIZE_BYTES, files: 1 },
}).single('answer'); // expects multipart field name "answer"
