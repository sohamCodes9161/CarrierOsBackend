import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------
// In-memory fake for the Interview model, realistic enough to exercise
// the real service logic end-to-end, including:
//  - .save() (fetch-modify-save path)
//  - .updateOne() with $set and positional '$' operator support (the
//    background audio-patch path)
//  - auto-assigned subdocument _ids on questions.push(), mimicking real
//    Mongoose behavior, since the service reads the new question's _id
//    immediately after pushing it.
// ---------------------------------------------------------------------
const savedDocs = new Map();
let idCounter = 0;
let questionIdCounter = 0;

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) current = current[parts[i]];
  current[parts[parts.length - 1]] = value;
}

function trackedQuestionsArray(seedQuestions) {
  const arr = seedQuestions.map((q) => ({ ...q, _id: q._id || `q-${++questionIdCounter}` }));
  return new Proxy(arr, {
    get(target, prop, receiver) {
      if (prop === 'push') {
        return (...items) => {
          items.forEach((item) => {
            if (!item._id) item._id = `q-${++questionIdCounter}`;
          });
          return Array.prototype.push.apply(target, items);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function makeFakeInterviewClass() {
  return {
    create: jest.fn().mockImplementation(async (doc) => {
      const id = `interview-${++idCounter}`;
      const record = {
        ...doc,
        _id: id,
        questions: trackedQuestionsArray(doc.questions || []),
        save: async function () {
          savedDocs.set(id, this);
          return this;
        },
      };
      savedDocs.set(id, record);
      return record;
    }),
    findById: jest.fn().mockImplementation(async (id) => savedDocs.get(id) || null),
    updateOne: jest.fn().mockImplementation(async (filter, update) => {
      const doc = savedDocs.get(filter._id);
      if (!doc) return { matchedCount: 0 };

      let questionIndex = null;
      if (filter['questions._id'] !== undefined) {
        questionIndex = doc.questions.findIndex((q) => q._id === filter['questions._id']);
        if (questionIndex === -1) return { matchedCount: 0 };
      }

      for (const [path, value] of Object.entries(update.$set || {})) {
        const resolvedPath = questionIndex !== null ? path.replace('$', questionIndex) : path;
        setByPath(doc, resolvedPath, value);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }),
  };
}

let questionCallCount = 0;

jest.unstable_mockModule('../src/models/Interview.model.js', () => ({
  Interview: makeFakeInterviewClass(),
}));

jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: jest.fn().mockImplementation(async ({ prompt }) => {
    if (prompt.includes('Generate the next interview question')) {
      questionCallCount += 1;
      return { question: `Mock question #${questionCallCount}`, focusArea: 'Mock Focus' };
    }
    if (prompt.includes('Synthesize this into an honest')) {
      return {
        overallScore: 72,
        summary: 'Decent overall performance.',
        strengths: ['Clear explanations'],
        weaknesses: ['Missed edge cases'],
        recommendation: 'Practice edge-case handling.',
        readyForRole: true,
      };
    }
    return {
      correctnessScore: 80,
      communicationScore: 75,
      missingConcepts: ['edge cases'],
      strengths: ['Good structure'],
      weaknesses: ['Missed edge cases'],
      feedback: 'Solid but incomplete.',
    };
  }),
}));

jest.unstable_mockModule('../src/integrations/edgeTts.integration.js', () => ({
  synthesizeSpeech: jest.fn().mockResolvedValue(Buffer.from('fake-mp3-bytes')),
}));

jest.unstable_mockModule('../src/integrations/groqAudio.integration.js', () => ({
  transcribeAudio: jest.fn().mockResolvedValue('transcribed answer text'),
}));

jest.unstable_mockModule('../src/integrations/cloudinary.integration.js', () => ({
  uploadBufferToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/demo/video/upload/fake-audio.mp3',
    public_id: 'careeros/interview-audio/fake-audio',
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

const { startInterview, submitAnswer, submitAudioAnswer } = await import('../src/services/interview.service.js');
const { synthesizeSpeech } = await import('../src/integrations/edgeTts.integration.js');
const { transcribeAudio } = await import('../src/integrations/groqAudio.integration.js');
const { uploadBufferToCloudinary } = await import('../src/integrations/cloudinary.integration.js');

describe('Interview lifecycle (mocked Groq + in-memory model)', () => {
  beforeEach(() => {
    savedDocs.clear();
    idCounter = 0;
    questionIdCounter = 0;
    questionCallCount = 0;
    jest.clearAllMocks();
  });

  it('starts an interview with exactly one question and in_progress status', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js'],
      totalQuestions: 3,
    });

    expect(interview.status).toBe('in_progress');
    expect(interview.questions).toHaveLength(1);
    expect(interview.questions[0].questionNumber).toBe(1);
    expect(interview.questions[0].answerText).toBeNull();
  });

  it('generates a new question after each answer until totalQuestions is reached, then completes', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 3,
    });

    const { interview: afterFirst } = await submitAnswer({
      interviewId: interview._id,
      userId: 'user1',
      answerText: 'My answer to question 1',
    });
    expect(afterFirst.status).toBe('in_progress');
    expect(afterFirst.questions).toHaveLength(2);
    expect(afterFirst.questions[0].evaluation).not.toBeNull();
    expect(afterFirst.questions[1].answerText).toBeNull();

    const { interview: afterSecond } = await submitAnswer({
      interviewId: interview._id,
      userId: 'user1',
      answerText: 'My answer to question 2',
    });
    expect(afterSecond.status).toBe('in_progress');
    expect(afterSecond.questions).toHaveLength(3);

    const { interview: afterThird } = await submitAnswer({
      interviewId: interview._id,
      userId: 'user1',
      answerText: 'My answer to question 3',
    });
    expect(afterThird.status).toBe('completed');
    expect(afterThird.questions).toHaveLength(3);
    expect(afterThird.finalReport).not.toBeNull();
    expect(afterThird.finalReport.overallScore).toBe(72);
  });

  it('rejects answering an already-completed interview', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'easy',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 1,
    });

    await submitAnswer({ interviewId: interview._id, userId: 'user1', answerText: 'Answer 1' });

    await expect(
      submitAnswer({ interviewId: interview._id, userId: 'user1', answerText: 'Answer 2' })
    ).rejects.toThrow('already been completed');
  });

  it('rejects a user trying to answer someone else\'s interview', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'easy',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 3,
    });

    await expect(
      submitAnswer({ interviewId: interview._id, userId: 'attacker', answerText: 'Answer' })
    ).rejects.toThrow('do not have access');
  });

  it('throws NotFoundError for a nonexistent interview id', async () => {
    await expect(
      submitAnswer({ interviewId: 'does-not-exist', userId: 'user1', answerText: 'Answer' })
    ).rejects.toThrow('not found');
  });
});

describe('Voice-enabled interview lifecycle (background audio patching)', () => {
  beforeEach(() => {
    savedDocs.clear();
    idCounter = 0;
    questionIdCounter = 0;
    questionCallCount = 0;
    jest.clearAllMocks();
  });

  it('does NOT call synthesizeSpeech when voiceEnabled is false (default)', async () => {
    await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 3,
      voiceEnabled: false,
    });
    expect(synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('returns audio fields as null immediately - the response does not wait on TTS', async () => {
    const { interview, audioTask } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js'],
      totalQuestions: 3,
      voiceEnabled: true,
    });

    expect(interview.greetingAudioUrl).toBeNull();
    expect(interview.questions[0].questionAudioUrl).toBeNull();
    expect(audioTask).not.toBeNull();

    await audioTask;
  });

  it('patches greeting + first question audio onto the same document once the background task resolves', async () => {
    const { interview, audioTask } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: ['Node.js'],
      totalQuestions: 3,
      voiceEnabled: true,
    });

    await audioTask;

    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(uploadBufferToCloudinary).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ resourceType: 'video' })
    );
    expect(interview.greetingAudioUrl).toBe('https://res.cloudinary.com/demo/video/upload/fake-audio.mp3');
    expect(interview.questions[0].questionAudioUrl).toBe(
      'https://res.cloudinary.com/demo/video/upload/fake-audio.mp3'
    );
  });

  it('generates and patches audio for the next question after each answer in voice mode', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 2,
      voiceEnabled: true,
    });
    synthesizeSpeech.mockClear();

    const { interview: afterAnswer, audioTask } = await submitAnswer({
      interviewId: interview._id,
      userId: 'user1',
      answerText: 'My answer',
    });

    expect(afterAnswer.questions[1].questionAudioUrl).toBeNull();

    await audioTask;

    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(afterAnswer.questions[1].questionAudioUrl).not.toBeNull();
  });

  it('generates and patches audio for the final report when the interview completes in voice mode', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'easy',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 1,
      voiceEnabled: true,
    });
    synthesizeSpeech.mockClear();

    const { interview: completed, audioTask } = await submitAnswer({
      interviewId: interview._id,
      userId: 'user1',
      answerText: 'My final answer',
    });

    expect(completed.status).toBe('completed');
    expect(completed.finalReport.audioUrl).toBeNull();

    await audioTask;

    expect(synthesizeSpeech).toHaveBeenCalledTimes(1);
    expect(completed.finalReport.audioUrl).not.toBeNull();
  });

  it('a failed background audio synthesis does not throw or affect the already-returned interview', async () => {
    synthesizeSpeech.mockRejectedValueOnce(new Error('TTS service unreachable'));

    const { interview, audioTask } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 3,
      voiceEnabled: true,
    });

    expect(interview.status).toBe('in_progress');
    await expect(audioTask).resolves.not.toThrow();
  });

  it('submitAudioAnswer transcribes the audio then reuses the same submitAnswer logic', async () => {
    const { interview } = await startInterview({
      userId: 'user1',
      role: 'Backend Engineer',
      difficulty: 'medium',
      interviewType: 'technical',
      targetSkills: [],
      totalQuestions: 3,
      voiceEnabled: false,
    });

    const { interview: updated, transcript } = await submitAudioAnswer({
      interviewId: interview._id,
      userId: 'user1',
      audioBuffer: Buffer.from('fake audio bytes'),
      filename: 'answer.webm',
      mimetype: 'audio/webm',
    });

    expect(transcribeAudio).toHaveBeenCalledWith(expect.any(Buffer), 'answer.webm', 'audio/webm');
    expect(transcript).toBe('transcribed answer text');
    expect(updated.questions[0].answerText).toBe('transcribed answer text');
  });
});
