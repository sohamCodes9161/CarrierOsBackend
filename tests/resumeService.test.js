import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock every external integration BEFORE importing the service that uses them
jest.unstable_mockModule('../src/integrations/textExtractor.js', () => ({
  extractTextFromBuffer: jest.fn().mockResolvedValue('extracted resume text'),
}));

jest.unstable_mockModule('../src/integrations/cloudinary.integration.js', () => ({
  uploadBufferToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://res.cloudinary.com/demo/raw/upload/fake.pdf',
    public_id: 'careeros/resumes/fake',
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: jest.fn().mockResolvedValue({
    atsScore: 78,
    jobMatchScore: -1,
    summary: 'Solid resume overall.',
    strengths: ['Clear structure'],
    weaknesses: ['Missing quantified impact'],
    missingKeywords: [],
    extractedSkills: ['Node.js', 'MongoDB'],
    sectionFeedback: [{ section: 'Experience', feedback: 'Add metrics' }],
    suggestedBulletImprovements: [],
  }),
}));

jest.unstable_mockModule('../src/models/Resume.model.js', () => ({
  Resume: {
    create: jest.fn().mockImplementation((doc) => Promise.resolve({ _id: 'resume123', ...doc })),
  },
}));

jest.unstable_mockModule('../src/models/ResumeAnalysis.model.js', () => ({
  ResumeAnalysis: {
    create: jest.fn().mockImplementation((doc) => Promise.resolve({ _id: 'analysis123', ...doc })),
  },
}));

const { uploadAndAnalyzeResume } = await import('../src/services/resume.service.js');
const { extractTextFromBuffer } = await import('../src/integrations/textExtractor.js');
const { uploadBufferToCloudinary } = await import('../src/integrations/cloudinary.integration.js');
const { generateStructuredContent } = await import('../src/integrations/groq.integration.js');
const { Resume } = await import('../src/models/Resume.model.js');
const { ResumeAnalysis } = await import('../src/models/ResumeAnalysis.model.js');

describe('uploadAndAnalyzeResume (mocked integrations)', () => {
  beforeEach(() => jest.clearAllMocks());

  const fakeFile = {
    buffer: Buffer.from('fake pdf bytes'),
    mimetype: 'application/pdf',
    originalname: 'resume.pdf',
  };

  it('extracts text before uploading to Cloudinary (fail-fast ordering)', async () => {
    await uploadAndAnalyzeResume({ userId: 'user1', file: fakeFile, jobDescription: null });

    const extractOrder = extractTextFromBuffer.mock.invocationCallOrder[0];
    const uploadOrder = uploadBufferToCloudinary.mock.invocationCallOrder[0];
    expect(extractOrder).toBeLessThan(uploadOrder);
  });

  it('passes extracted text into the AI prompt pipeline', async () => {
    await uploadAndAnalyzeResume({ userId: 'user1', file: fakeFile, jobDescription: 'JD text' });
    expect(generateStructuredContent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('extracted resume text'),
      })
    );
  });

  it('saves the Resume with the Cloudinary URL', async () => {
    await uploadAndAnalyzeResume({ userId: 'user1', file: fakeFile, jobDescription: null });
    expect(Resume.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cloudinaryUrl: 'https://res.cloudinary.com/demo/raw/upload/fake.pdf',
        user: 'user1',
      })
    );
  });

  it('saves the ResumeAnalysis linked to the created resume and user', async () => {
    await uploadAndAnalyzeResume({ userId: 'user1', file: fakeFile, jobDescription: null });
    expect(ResumeAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resume: 'resume123',
        user: 'user1',
        atsScore: 78,
      })
    );
  });

  it('returns both resume and analysis', async () => {
    const result = await uploadAndAnalyzeResume({ userId: 'user1', file: fakeFile, jobDescription: null });
    expect(result.resume._id).toBe('resume123');
    expect(result.analysis._id).toBe('analysis123');
  });
});
