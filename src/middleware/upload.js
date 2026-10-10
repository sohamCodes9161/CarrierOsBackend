import multer from 'multer';
import { BadRequestError } from '../errors/AppError.js';

// 1. Define allowed types for Resumes
const ALLOWED_RESUME_TYPES = new Set([
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

// 2. Define allowed types for Portfolio Profile Photos
const ALLOWED_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for both

const storage = multer.memoryStorage(); // never touch disk - Render's filesystem is ephemeral

// 3. Smart file filter based on the field name
function fileFilter(req, file, cb) {
  if (file.fieldname === 'resume') {
    if (!ALLOWED_RESUME_TYPES.has(file.mimetype)) {
      return cb(new BadRequestError('Only PDF, DOC, and DOCX files are allowed for resumes'));
    }
  } else if (file.fieldname === 'photo') {
    if (!ALLOWED_PHOTO_TYPES.has(file.mimetype)) {
      return cb(new BadRequestError('Only JPEG, PNG, and WebP images are allowed for profile photos'));
    }
  }
  
  cb(null, true);
}

// 4. Create the base multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// 5. Export the named 'uploadResume' so we don't break your existing resume routes
export const uploadResume = upload.single('resume');

// 6. Export 'upload' as default so the new Portfolio routes can use it!
export default upload;