import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

/**
 * Uploads a buffer (e.g. from multer memoryStorage) to Cloudinary.
 * resource_type "raw" is used for documents (PDFs/DOCs). Cloudinary
 * requires resource_type "video" for audio files (it handles audio
 * through the same pipeline as video) - pass 'video' explicitly for those.
 */
export function uploadBufferToCloudinary(buffer, { folder = 'careeros/resumes', filename, resourceType = 'raw' }) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: filename ? filename.replace(/\.[^/.]+$/, '') : undefined,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

export async function deleteFromCloudinary(publicId, resourceType = 'raw') {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
