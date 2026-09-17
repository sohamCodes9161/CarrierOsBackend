import { Interview } from '../models/Interview.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import { synthesizeSpeech } from '../integrations/edgeTts.integration.js';
import { transcribeAudio } from '../integrations/groqAudio.integration.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../integrations/cloudinary.integration.js';
import { buildGreetingText } from '../utils/interviewGreeting.js';
import {
  buildInterviewQuestionPrompt,
  interviewQuestionSchema,
  interviewQuestionSchemaName,
} from '../integrations/prompts/interviewQuestion.prompt.js';
import {
  buildInterviewEvaluationPrompt,
  interviewEvaluationSchema,
  interviewEvaluationSchemaName,
} from '../integrations/prompts/interviewEvaluation.prompt.js';
import {
  buildInterviewReportPrompt,
  interviewReportSchema,
  interviewReportSchemaName,
} from '../integrations/prompts/interviewReport.prompt.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors/AppError.js';

/** Synthesizes speech and uploads it to Cloudinary, returning {url, publicId}. */
async function synthesizeAndStore(text, folder) {
  const audioBuffer = await synthesizeSpeech(text);
  const result = await uploadBufferToCloudinary(audioBuffer, {
    folder,
    filename: `${Date.now()}.mp3`,
    resourceType: 'video', // Cloudinary requires 'video' resource type for audio files
  });
  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Synthesizes speech and atomically patches the result onto an already-saved
 * interview document via `updateOne`, rather than fetch-modify-save. This is
 * deliberately NOT awaited by the callers below - it runs after the main
 * response has already been sent, so the candidate isn't stuck waiting on
 * TTS (which, being an unofficial WebSocket-based service, has the most
 * variable latency of anything in this pipeline - observed as high as
 * 100+ seconds in real testing). Using `updateOne` instead of loading-then-
 * saving the full document also avoids a version conflict with whatever
 * request comes in next for the same interview - it only touches the
 * specific field(s) it's responsible for.
 *
 * Errors are caught and logged, never thrown - a failed background audio
 * patch should never surface as a request failure, since the request it
 * was triggered by has already succeeded and returned.
 */
function synthesizeAndPatchAsync({ text, folder, filter, buildSetFields }) {
  return synthesizeAndStore(text, folder)
    .then(({ url, publicId }) => Interview.updateOne(filter, { $set: buildSetFields(url, publicId) }))
    .catch((err) => {
      console.error('[interview] background audio synthesis failed:', err.message);
    });
}

async function generateQuestion({ role, difficulty, interviewType, targetSkills, questionNumber, totalQuestions, history }) {
  const prompt = buildInterviewQuestionPrompt({
    role,
    difficulty,
    interviewType,
    targetSkills,
    questionNumber,
    totalQuestions,
    history,
  });
  return generateStructuredContent({
    prompt,
    responseSchema: interviewQuestionSchema,
    schemaName: interviewQuestionSchemaName,
  });
}

export async function startInterview({ userId, role, difficulty, interviewType, targetSkills, totalQuestions, voiceEnabled }) {
  const firstQuestion = await generateQuestion({
    role,
    difficulty,
    interviewType,
    targetSkills,
    questionNumber: 1,
    totalQuestions,
    history: [],
  });

  const interview = await Interview.create({
    user: userId,
    role,
    difficulty,
    interviewType,
    targetSkills,
    totalQuestions,
    status: 'in_progress',
    voiceEnabled,
    greetingAudioUrl: null,
    greetingAudioPublicId: null,
    questions: [
      {
        questionNumber: 1,
        questionText: firstQuestion.question,
        focusArea: firstQuestion.focusArea,
        answerText: null,
        answeredAt: null,
        evaluation: null,
        questionAudioUrl: null,
        questionAudioPublicId: null,
      },
    ],
  });

  let audioTask = null;

  if (voiceEnabled) {
    const greetingText = buildGreetingText({ role, difficulty, interviewType, targetSkills });
    const firstQuestionId = interview.questions[0]._id; // Mongoose assigns subdocument _ids at construction time, safe to read now

    // Fired but NOT awaited - the caller responds with the interview
    // immediately; these patch in audioUrl fields once synthesis finishes.
    audioTask = Promise.all([
      synthesizeAndPatchAsync({
        text: greetingText,
        folder: 'careeros/interview-audio',
        filter: { _id: interview._id },
        buildSetFields: (url, publicId) => ({ greetingAudioUrl: url, greetingAudioPublicId: publicId }),
      }),
      synthesizeAndPatchAsync({
        text: firstQuestion.question,
        folder: 'careeros/interview-audio',
        filter: { _id: interview._id, 'questions._id': firstQuestionId },
        buildSetFields: (url, publicId) => ({
          'questions.$.questionAudioUrl': url,
          'questions.$.questionAudioPublicId': publicId,
        }),
      }),
    ]);
  }

  return { interview, audioTask };
}

export async function submitAnswer({ interviewId, userId, answerText }) {
  const interview = await Interview.findById(interviewId);
  if (!interview) {
    throw new NotFoundError('Interview not found');
  }
  if (interview.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this interview');
  }
  if (interview.status === 'completed') {
    throw new BadRequestError('This interview has already been completed');
  }

  const currentQuestion = interview.questions[interview.questions.length - 1];
  if (!currentQuestion || currentQuestion.answerText !== null) {
    throw new BadRequestError('No pending question to answer');
  }

  // 1. Evaluate the answer just given
  const evalPrompt = buildInterviewEvaluationPrompt({
    role: interview.role,
    question: currentQuestion.questionText,
    focusArea: currentQuestion.focusArea,
    answerText,
  });
  const evaluation = await generateStructuredContent({
    prompt: evalPrompt,
    responseSchema: interviewEvaluationSchema,
    schemaName: interviewEvaluationSchemaName,
  });

  currentQuestion.answerText = answerText;
  currentQuestion.answeredAt = new Date();
  currentQuestion.evaluation = evaluation;

  const isLastQuestion = interview.questions.length >= interview.totalQuestions;
  let finalReport = null;
  let nextQuestion = null;

  if (isLastQuestion) {
    // 2a. Interview complete - generate final report
    const reportPrompt = buildInterviewReportPrompt({
      role: interview.role,
      difficulty: interview.difficulty,
      interviewType: interview.interviewType,
      history: interview.questions,
    });
    finalReport = await generateStructuredContent({
      prompt: reportPrompt,
      responseSchema: interviewReportSchema,
      schemaName: interviewReportSchemaName,
    });

    interview.status = 'completed';
    interview.finalReport = { ...finalReport, audioUrl: null, audioPublicId: null };
    interview.completedAt = new Date();
  } else {
    // 2b. Generate the next adaptive question
    nextQuestion = await generateQuestion({
      role: interview.role,
      difficulty: interview.difficulty,
      interviewType: interview.interviewType,
      targetSkills: interview.targetSkills,
      questionNumber: interview.questions.length + 1,
      totalQuestions: interview.totalQuestions,
      history: interview.questions,
    });

    interview.questions.push({
      questionNumber: interview.questions.length + 1,
      questionText: nextQuestion.question,
      focusArea: nextQuestion.focusArea,
      answerText: null,
      answeredAt: null,
      evaluation: null,
      questionAudioUrl: null,
      questionAudioPublicId: null,
    });
  }

  // Save all text-based state now - the response is built from this, and the
  // saved subdocument ids are what the background audio patch below targets.
  // Saving here (rather than after audio) is what lets us respond
  // immediately without waiting on the slowest, most variable step.
  await interview.save();

  let audioTask = null;

  if (interview.voiceEnabled) {
    if (isLastQuestion) {
      const reportSpeechText = `${finalReport.summary} ${finalReport.recommendation}`;
      audioTask = synthesizeAndPatchAsync({
        text: reportSpeechText,
        folder: 'careeros/interview-audio',
        filter: { _id: interview._id },
        buildSetFields: (url, publicId) => ({ 'finalReport.audioUrl': url, 'finalReport.audioPublicId': publicId }),
      });
    } else {
      const newQuestionId = interview.questions[interview.questions.length - 1]._id;
      audioTask = synthesizeAndPatchAsync({
        text: nextQuestion.question,
        folder: 'careeros/interview-audio',
        filter: { _id: interview._id, 'questions._id': newQuestionId },
        buildSetFields: (url, publicId) => ({
          'questions.$.questionAudioUrl': url,
          'questions.$.questionAudioPublicId': publicId,
        }),
      });
    }
  }

  return { interview, audioTask };
}

/**
 * Transcribes a recorded audio answer, then delegates to submitAnswer -
 * the exact same tested evaluation/adaptive-question/completion logic runs
 * either way. Returns both the interview state and the raw transcript, so
 * the caller can show the candidate what was actually heard (important for
 * debugging transcription accuracy).
 */
export async function submitAudioAnswer({ interviewId, userId, audioBuffer, filename, mimetype }) {
  const transcript = await transcribeAudio(audioBuffer, filename, mimetype);
  const { interview, audioTask } = await submitAnswer({ interviewId, userId, answerText: transcript });
  return { interview, transcript, audioTask };
}

export async function getInterviewById({ interviewId, userId }) {
  const interview = await Interview.findById(interviewId);
  if (!interview) {
    throw new NotFoundError('Interview not found');
  }
  if (interview.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this interview');
  }
  return interview;
}

export async function listInterviewsForUser(userId) {
  return Interview.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('role difficulty interviewType status totalQuestions createdAt completedAt finalReport.overallScore');
}
