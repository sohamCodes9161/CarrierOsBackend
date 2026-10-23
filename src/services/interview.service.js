import { Interview } from '../models/Interview.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import { transcribeAudio } from '../integrations/groqAudio.integration.js';
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

async function generateQuestion({ role, difficulty, interviewType, targetSkills, questionNumber, totalQuestions, history }) {
  const coveredAreas = history.map(h => (h.focusArea || '').toLowerCase());
  const remainingSkills = targetSkills.filter(
    skill => !coveredAreas.some(covered => covered.includes(skill.toLowerCase()))
  );

  const prompt = buildInterviewQuestionPrompt({
    role,
    difficulty,
    interviewType,
    targetSkills,
    remainingSkills,
    questionNumber,
    totalQuestions,
    history,
  });

  return generateStructuredContent({
    prompt,
    responseSchema: interviewQuestionSchema,
    schemaName: interviewQuestionSchemaName,
    temperature: 0.7,
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

  return { interview };
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

  await interview.save();

  return { interview };
}

export async function submitAudioAnswer({ interviewId, userId, audioBuffer, filename, mimetype }) {
  const transcript = await transcribeAudio(audioBuffer, filename, mimetype);
  const { interview } = await submitAnswer({ interviewId, userId, answerText: transcript });
  return { interview, transcript };
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