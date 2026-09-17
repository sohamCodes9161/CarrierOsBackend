import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalFilename: { type: String, required: true },
    mimetype: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    extractedText: { type: String, required: true },
  },
  { timestamps: true }
);

export const Resume = mongoose.model('Resume', resumeSchema);
