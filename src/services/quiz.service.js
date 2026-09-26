import fetch from 'node-fetch';
import { Quiz } from '../models/Quiz.model.js';
import { QuizAttempt } from '../models/QuizAttempt.model.js';
import { env } from '../config/env.js';
import { NotFoundError, BadRequestError } from '../errors/AppError.js';

/**
 * Calculates adaptive difficulty based on total attempts and past accuracy
 */
const calculateAdaptiveDifficulty = async (userId, topic) => {
  const pastAttempts = await QuizAttempt.find({ user: userId, topic })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const totalAttempts = pastAttempts.length;
  if (totalAttempts === 0) {
    return { level: 'easy', breakdown: { easy: 3, medium: 2, hard: 0 } };
  }

  const avgAccuracy =
    pastAttempts.reduce((acc, curr) => acc + curr.accuracyPercentage, 0) /
    totalAttempts;

  if (avgAccuracy >= 80 || totalAttempts >= 4) {
    return { level: 'mastery', breakdown: { easy: 0, medium: 2, hard: 3 } };
  } else if (avgAccuracy >= 60 || totalAttempts >= 2) {
    return { level: 'balanced', breakdown: { easy: 1, medium: 3, hard: 1 } };
  }

  return { level: 'easy', breakdown: { easy: 3, medium: 2, hard: 0 } };
};

/**
 * Calls Groq AI to generate unique MCQs with negative question constraints
 */
const generateQuestionsWithAI = async (topic, difficultyConfig, pastQuestions = [], questionCount = 5) => {
  const negativeConstraints = pastQuestions.length > 0
    ? `DO NOT generate any of the following previous questions or close variations:\n- ${pastQuestions.slice(-15).join('\n- ')}`
    : '';

  const prompt = `You are a technical quiz creator for CareerOS. Generate exactly ${questionCount} multiple-choice questions on the topic: "${topic}".

Difficulty Distribution Required:
- Easy: ${difficultyConfig.breakdown.easy}
- Medium: ${difficultyConfig.breakdown.medium}
- Hard: ${difficultyConfig.breakdown.hard}

${negativeConstraints}

Respond ONLY with valid, raw JSON (no markdown block formatting, no extra text) matching this schema:
[
  {
    "questionText": "Question string?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOptionIndex": 0,
    "explanation": "Clear explanation of why option index 0 is correct.",
    "difficulty": "easy"
  }
]`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '[]';
    const cleanedJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanedJson);
  } catch (error) {
    // Fallback static fallback questions if AI key is missing or fails
    return [
      {
        questionText: `What is a core principle of ${topic}?`,
        options: [
          `Modular architecture in ${topic}`,
          'Monolithic synchronous loops',
          'Global namespace pollution',
          'Unhandled memory allocations',
        ],
        correctOptionIndex: 0,
        explanation: `Modular architecture is a core design standard for ${topic}.`,
        difficulty: 'easy',
      },
      {
        questionText: `Which pattern is commonly applied when working with ${topic}?`,
        options: [
          'Anti-pattern coupling',
          'Dependency Injection / Modular Pattern',
          'Blocking execution loop',
          'Hardcoded state mutations',
        ],
        correctOptionIndex: 1,
        explanation: `Dependency Injection and Modular patterns improve maintainability in ${topic}.`,
        difficulty: 'medium',
      },
      {
        questionText: `What is an important security/performance consideration in ${topic}?`,
        options: [
          'Exposing internal credentials',
          'Skipping parameter validation',
          'Proper input sanitization & rate limiting',
          'Disabling CORS completely',
        ],
        correctOptionIndex: 2,
        explanation: 'Input sanitization and rate limiting prevent common execution vulnerabilities.',
        difficulty: 'medium',
      },
    ];
  }
};

/**
 * Generate a new Quiz
 */
export const generateQuiz = async (userId, { topic, roadmapId, nodeId, questionCount = 5 }) => {
  // 1. Calculate adaptive difficulty
  const difficultyConfig = await calculateAdaptiveDifficulty(userId, topic);

  // 2. Fetch past generated questions for anti-repetition engine
  const pastQuizzes = await Quiz.find({ user: userId, topic }).lean();
  const pastQuestions = pastQuizzes.flatMap((q) => q.questions.map((quest) => quest.questionText));

  // 3. Generate fresh questions via AI
  const questions = await generateQuestionsWithAI(topic, difficultyConfig, pastQuestions, questionCount);

  // 4. Save Quiz
  const timeLimitSeconds = questionCount * 60; // 1 minute per question
  const quiz = await Quiz.create({
    user: userId,
    topic,
    roadmap: roadmapId || null,
    nodeId: nodeId || null,
    difficultyLevel: difficultyConfig.level,
    timeLimitSeconds,
    questions,
  });

  // Strip correctOptionIndex and explanation before returning to client
  const clientQuestions = quiz.questions.map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    options: q.options,
    difficulty: q.difficulty,
  }));

  return {
    _id: quiz._id,
    topic: quiz.topic,
    difficultyLevel: quiz.difficultyLevel,
    timeLimitSeconds: quiz.timeLimitSeconds,
    totalQuestions: clientQuestions.length,
    questions: clientQuestions,
  };
};

/**
 * Submit and Grade Quiz Attempt
 */
export const submitQuiz = async (userId, { quizId, totalTimeSpentSeconds, answers }) => {
  const quiz = await Quiz.findById(quizId).select('+questions.correctOptionIndex');
  if (!quiz) {
    throw new NotFoundError('Quiz not found');
  }

  let correctCount = 0;
  const userResponses = [];
  const failedQuestionBreakdown = [];

  quiz.questions.forEach((q) => {
    const userAns = answers.find((a) => a.questionId.toString() === q._id.toString());
    const selectedIdx = userAns ? userAns.selectedOptionIndex : -1;
    const isCorrect = selectedIdx === q.correctOptionIndex;

    if (isCorrect) {
      correctCount++;
    } else {
      failedQuestionBreakdown.push({
        questionText: q.questionText,
        yourAnswer: selectedIdx >= 0 ? q.options[selectedIdx] : 'No answer provided',
        correctAnswer: q.options[q.correctOptionIndex],
        explanation: q.explanation,
      });
    }

    userResponses.push({
      questionId: q._id,
      selectedOptionIndex: selectedIdx,
      isCorrect,
      timeSpentSeconds: userAns?.timeSpentSeconds || 0,
    });
  });

  const accuracyPercentage = Math.round((correctCount / quiz.questions.length) * 100);
  const timeBonusMultiplier = totalTimeSpentSeconds < quiz.timeLimitSeconds * 0.75 ? 1.15 : 1.0;
  const score = Math.round(accuracyPercentage * timeBonusMultiplier);

  // Generate AI debrief
  const speedAnalysis = totalTimeSpentSeconds <= quiz.timeLimitSeconds
    ? `Completed in ${totalTimeSpentSeconds}s (within target limit of ${quiz.timeLimitSeconds}s).`
    : `Completed in ${totalTimeSpentSeconds}s (exceeded target limit of ${quiz.timeLimitSeconds}s).`;

  const aiDebrief = {
    summary: accuracyPercentage >= 80
      ? `Strong mastery of ${quiz.topic}!`
      : `Good effort on ${quiz.topic}. Review missed concepts to strengthen mastery.`,
    strengths: accuracyPercentage >= 50 ? [`Understanding core ${quiz.topic} concepts`] : [],
    growthAreas: failedQuestionBreakdown.length > 0 ? [`Reviewing failed ${quiz.topic} questions`] : [],
    speedAnalysis,
    failedQuestionBreakdown,
  };

  const attempt = await QuizAttempt.create({
    user: userId,
    quiz: quiz._id,
    topic: quiz.topic,
    score,
    totalQuestions: quiz.questions.length,
    accuracyPercentage,
    totalTimeSpentSeconds,
    timeBonusMultiplier,
    userResponses,
    aiDebrief,
  });

  return attempt;
};

/**
 * Get Quiz History
 */
export const getQuizHistory = async (userId, topic) => {
  const filter = { user: userId };
  if (topic) filter.topic = topic;

  return await QuizAttempt.find(filter).sort({ createdAt: -1 }).lean();
};