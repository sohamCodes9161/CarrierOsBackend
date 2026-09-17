import { Resume } from '../models/Resume.model.js';
import { ResumeAnalysis } from '../models/ResumeAnalysis.model.js';
import { extractTextFromBuffer } from '../integrations/textExtractor.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../integrations/cloudinary.integration.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import {
  buildResumeAnalysisPrompt,
  resumeAnalysisSchema,
  resumeAnalysisSchemaName,
} from '../integrations/prompts/resumeAnalysis.prompt.js';
import { NotFoundError, ForbiddenError } from '../errors/AppError.js';

export async function uploadAndAnalyzeResume({ userId, file, jobDescription }) {
  // 1. Deterministic text extraction first - fail fast before any upload/AI cost
  // if the file isn't actually readable.
  const extractedText = await extractTextFromBuffer(file.buffer, file.mimetype);

  // 2. Store the original file in Cloudinary for the user's record.
  const uploadResult = await uploadBufferToCloudinary(file.buffer, {
    filename: file.originalname,
  });

  const resume = await Resume.create({
    user: userId,
    originalFilename: file.originalname,
    mimetype: file.mimetype,
    cloudinaryUrl: uploadResult.secure_url,
    cloudinaryPublicId: uploadResult.public_id,
    extractedText,
  });

  // 3. AI analysis via Groq, strictly schema-constrained.
  const prompt = buildResumeAnalysisPrompt({ resumeText: extractedText, jobDescription });
  const aiResult = await generateStructuredContent({
    prompt,
    responseSchema: resumeAnalysisSchema,
    schemaName: resumeAnalysisSchemaName,
  });

  const analysis = await ResumeAnalysis.create({
    resume: resume._id,
    user: userId,
    jobDescription: jobDescription || null,
    ...aiResult,
  });

  return { resume, analysis };
}

export async function getResumeAnalysisById({ analysisId, userId }) {
  const analysis = await ResumeAnalysis.findById(analysisId).populate('resume');
  if (!analysis) {
    throw new NotFoundError('Resume analysis not found');
  }
  if (analysis.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this analysis');
  }
  return analysis;
}

export async function listResumeAnalysesForUser(userId) {
  return ResumeAnalysis.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('atsScore jobMatchScore summary createdAt resume')
    .populate('resume', 'originalFilename cloudinaryUrl createdAt');
}

export async function deleteResume({ resumeId, userId }) {
  const resume = await Resume.findById(resumeId);
  if (!resume) {
    throw new NotFoundError('Resume not found');
  }
  if (resume.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this resume');
  }

  await deleteFromCloudinary(resume.cloudinaryPublicId);
  await ResumeAnalysis.deleteMany({ resume: resume._id });
  await resume.deleteOne();
}
