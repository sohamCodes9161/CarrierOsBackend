import * as interviewService from '../services/interview.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../errors/AppError.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';

// --- NEW: AI Validation Middleware ---
export const validateInputAI = asyncHandler(async (req, res, next) => {
  const { role, targetSkills } = req.body;

  if (!role || !targetSkills || targetSkills.length === 0) {
    throw new BadRequestError('Role and target skills are required.');
  }

  const validationSchema = {
    type: 'object',
    properties: {
      isValid: { type: 'boolean', description: 'True if the role and skills represent a plausible tech role, programming language, framework, or software engineering position.' },
      reason: { type: 'string', description: 'If invalid, a short explanation why.' }
    },
    required: ['isValid', 'reason']
  };

  const validation = await generateStructuredContent({
    prompt: `Analyze this interview request. Role: "${role}". Skills: "${targetSkills.join(', ')}". 
    CRITICAL RULE: Programming languages, frameworks, and libraries (like React, Node, Python, Vue, Angular, C++) ARE valid roles and technologies. 
    Only mark isValid as false if it is pure gibberish, a keyboard smash (e.g. "asdfgh"), inappropriate/offensive language, or completely nonsensical text (e.g. "3 kg mass", "i need sex"). Is this valid?`,
    responseSchema: validationSchema,
    schemaName: 'input_validation'
  });

  if (!validation.isValid) {
    throw new BadRequestError(`Invalid interview parameters: ${validation.reason}`);
  }

  // If valid, move to the next step (which will be checking and deducting the quota)
  next();
});
// -------------------------------------

export const start = asyncHandler(async (req, res) => {
  const { role, targetSkills, difficulty, interviewType, voiceEnabled, totalQuestions } = req.body;

  // Start the interview directly (Validation and Limits are already handled by routes)
  const { interview, audioTask } = await interviewService.startInterview({
    userId: req.userId,
    role: role.trim(),
    targetSkills,
    difficulty,
    interviewType,
    voiceEnabled,
    totalQuestions,
  });
  
  void audioTask;

  sendSuccess(res, {
    statusCode: 201,
    message: 'Interview started',
    data: { interview },
  });
});

export const answer = asyncHandler(async (req, res) => {
  const answerText = req.body.answerText?.trim();

  if (!answerText) {
    throw new BadRequestError('Answer text is required.');
  }

  const { interview, audioTask } = await interviewService.submitAnswer({
    interviewId: req.params.id,
    userId: req.userId,
    answerText,
  });
  void audioTask;

  sendSuccess(res, {
    message: interview.status === 'completed' ? 'Interview completed' : 'Answer recorded',
    data: { interview },
  });
});

export const answerWithAudio = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('No audio file provided. Upload it under the "answer" field.');
  }

  const { interview, transcript, audioTask } = await interviewService.submitAudioAnswer({
    interviewId: req.params.id,
    userId: req.userId,
    audioBuffer: req.file.buffer,
    filename: req.file.originalname || 'answer.webm',
    mimetype: req.file.mimetype,
  });
  void audioTask;

  sendSuccess(res, {
    message: interview.status === 'completed' ? 'Interview completed' : 'Answer recorded',
    data: { interview, transcript },
  });
});

export const getInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.getInterviewById({
    interviewId: req.params.id,
    userId: req.userId,
  });
  sendSuccess(res, { data: { interview } });
});

export const listInterviews = asyncHandler(async (req, res) => {
  const interviews = await interviewService.listInterviewsForUser(req.userId);
  sendSuccess(res, { data: { interviews } });
});