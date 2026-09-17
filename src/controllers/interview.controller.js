import * as interviewService from '../services/interview.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../errors/AppError.js';

export const start = asyncHandler(async (req, res) => {
  const { interview, audioTask } = await interviewService.startInterview({
    userId: req.userId,
    ...req.body,
  });
  // audioTask (if voice is enabled) is intentionally NOT awaited here - it
  // continues running after the response is sent and patches audio URLs
  // in later via the DB. See interview.service.js for why.
  void audioTask;

  sendSuccess(res, {
    statusCode: 201,
    message: 'Interview started',
    data: { interview },
  });
});

export const answer = asyncHandler(async (req, res) => {
  const { interview, audioTask } = await interviewService.submitAnswer({
    interviewId: req.params.id,
    userId: req.userId,
    answerText: req.body.answerText,
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
