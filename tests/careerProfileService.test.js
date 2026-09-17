import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockFindOneAndUpdate = jest.fn();

jest.unstable_mockModule('../src/models/CareerProfile.model.js', () => ({
  CareerProfile: {
    findOneAndUpdate: mockFindOneAndUpdate,
    findOne: jest.fn(),
  },
}));

const mockResumeFindOne = jest.fn();
jest.unstable_mockModule('../src/models/ResumeAnalysis.model.js', () => ({
  ResumeAnalysis: { findOne: jest.fn(() => ({ sort: mockResumeFindOne })) },
}));

const mockGithubFindOne = jest.fn();
jest.unstable_mockModule('../src/models/GithubAnalysis.model.js', () => ({
  GithubAnalysis: { findOne: jest.fn(() => ({ sort: mockGithubFindOne })) },
}));

const mockInterviewFind = jest.fn();
jest.unstable_mockModule('../src/models/Interview.model.js', () => ({
  Interview: { find: jest.fn(() => ({ select: mockInterviewFind })) },
}));

jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: jest.fn().mockResolvedValue({
    narrative: 'A solid, well-rounded candidate profile.',
    overallReadinessLevel: 'developing',
    topPriorityFocus: ['Practice system design', 'Add tests to GitHub projects'],
  }),
}));

const { generateCareerProfile, getCareerProfile } = await import('../src/services/careerProfile.service.js');
const { CareerProfile } = await import('../src/models/CareerProfile.model.js');
const { generateStructuredContent } = await import('../src/integrations/groq.integration.js');

describe('generateCareerProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOneAndUpdate.mockResolvedValue({
      _id: 'profile1',
      narrative: 'A solid, well-rounded candidate profile.',
      overallReadinessLevel: 'developing',
    });
  });

  it('throws BadRequestError when no data sources exist at all', async () => {
    mockResumeFindOne.mockResolvedValue(null);
    mockGithubFindOne.mockResolvedValue(null);
    mockInterviewFind.mockResolvedValue([]);

    await expect(generateCareerProfile('user1')).rejects.toThrow('Complete at least one');
    expect(generateStructuredContent).not.toHaveBeenCalled(); // fail-fast, no wasted AI call
  });

  it('proceeds when only one data source exists', async () => {
    mockResumeFindOne.mockResolvedValue({ atsScore: 70, jobMatchScore: -1, extractedSkills: [], strengths: [], weaknesses: [], createdAt: new Date(), _id: 'r1' });
    mockGithubFindOne.mockResolvedValue(null);
    mockInterviewFind.mockResolvedValue([]);

    const profile = await generateCareerProfile('user1');
    expect(profile).toBeDefined();
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
  });

  it('fetches all three sources in parallel and passes them into the aggregation', async () => {
    mockResumeFindOne.mockResolvedValue({ atsScore: 80, jobMatchScore: 75, extractedSkills: ['Node.js'], strengths: [], weaknesses: [], createdAt: new Date(), _id: 'r1' });
    mockGithubFindOne.mockResolvedValue({ estimatedSkillLevel: 'intermediate', totalStars: 5, githubUsername: 'jane', inferredSkills: [], strengths: [], areasForImprovement: [], createdAt: new Date(), _id: 'g1' });
    mockInterviewFind.mockResolvedValue([]);

    await generateCareerProfile('user1');

    const prompt = generateStructuredContent.mock.calls[0][0].prompt;
    expect(prompt).toContain('Node.js');
    expect(prompt).toContain('Resume analysis: yes');
  });

  it('upserts via findOneAndUpdate rather than fetch-then-save', async () => {
    mockResumeFindOne.mockResolvedValue({ atsScore: 70, jobMatchScore: -1, extractedSkills: [], strengths: [], weaknesses: [], createdAt: new Date(), _id: 'r1' });
    mockGithubFindOne.mockResolvedValue(null);
    mockInterviewFind.mockResolvedValue([]);

    await generateCareerProfile('user1');

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { user: 'user1' },
      expect.objectContaining({ narrative: expect.any(String), overallReadinessLevel: 'developing' }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });
});

describe('getCareerProfile', () => {
  it('throws NotFoundError when no profile has been generated yet', async () => {
    CareerProfile.findOne.mockResolvedValue(null);
    await expect(getCareerProfile('user1')).rejects.toThrow('No career profile');
  });

  it('returns the existing profile when found', async () => {
    CareerProfile.findOne.mockResolvedValue({ _id: 'profile1', narrative: 'Existing profile' });
    const profile = await getCareerProfile('user1');
    expect(profile.narrative).toBe('Existing profile');
  });
});
