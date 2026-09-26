import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockResumeSelect = jest.fn();
const mockResumeCount = jest.fn();
jest.unstable_mockModule('../src/models/ResumeAnalysis.model.js', () => ({
  ResumeAnalysis: {
    findOne: jest.fn(() => ({ sort: () => ({ select: mockResumeSelect }) })),
    countDocuments: mockResumeCount,
  },
}));

const mockGithubSelect = jest.fn();
jest.unstable_mockModule('../src/models/GithubAnalysis.model.js', () => ({
  GithubAnalysis: {
    findOne: jest.fn(() => ({ sort: () => ({ select: mockGithubSelect }) })),
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

const mockCareerProfileSelect = jest.fn();
jest.unstable_mockModule('../src/models/CareerProfile.model.js', () => ({
  CareerProfile: { findOne: jest.fn(() => ({ select: mockCareerProfileSelect })) },
}));

const mockInterviewSelect = jest.fn();
jest.unstable_mockModule('../src/models/Interview.model.js', () => ({
  Interview: { find: jest.fn(() => ({ select: mockInterviewSelect })) },
}));

const mockRoadmapSelect = jest.fn();
jest.unstable_mockModule('../src/models/Roadmap.model.js', () => ({
  Roadmap: { find: jest.fn(() => ({ select: mockRoadmapSelect })) },
}));

const mockPortfolioSelect = jest.fn();
jest.unstable_mockModule('../src/models/Portfolio.model.js', () => ({
  Portfolio: { findOne: jest.fn(() => ({ select: mockPortfolioSelect })) },
}));

const { getDashboard } = await import('../src/services/dashboard.service.js');

describe('getDashboard - brand new account (nothing used yet)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResumeSelect.mockResolvedValue(null);
    mockResumeCount.mockResolvedValue(0);
    mockGithubSelect.mockResolvedValue(null);
    mockCareerProfileSelect.mockResolvedValue(null);
    mockInterviewSelect.mockResolvedValue([]);
    mockRoadmapSelect.mockResolvedValue([]);
    mockPortfolioSelect.mockResolvedValue(null);
  });

  it('returns null for every module the user has not touched, without erroring', async () => {
    const result = await getDashboard('user1');

    expect(result.resume).toBeNull();
    expect(result.github).toBeNull();
    expect(result.careerProfile).toBeNull();
    expect(result.portfolio).toBeNull();
  });

  it('returns zeroed-out (not null) stats for interviews and roadmaps, since those are collections not singletons', async () => {
    const result = await getDashboard('user1');

    expect(result.interviews).toEqual({ totalCompleted: 0, averageScore: null, lastInterviewAt: null });
    expect(result.roadmaps).toEqual({ count: 0, items: [] });
  });
});

describe('getDashboard - populated account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResumeSelect.mockResolvedValue({
      atsScore: 78,
      jobMatchScore: 82,
      createdAt: new Date('2026-01-01'),
    });
    mockResumeCount.mockResolvedValue(3);

    mockGithubSelect.mockResolvedValue({
      estimatedSkillLevel: 'intermediate',
      totalStars: 42,
      githubUsername: 'janedoe',
      createdAt: new Date('2026-01-05'),
    });

    mockCareerProfileSelect.mockResolvedValue({
      overallReadinessLevel: 'developing',
      generatedAt: new Date('2026-01-10'),
      skills: [{ name: 'Node.js' }, { name: 'MongoDB' }],
    });

    mockInterviewSelect.mockResolvedValue([
      { finalReport: { overallScore: 70 }, completedAt: new Date('2026-01-15') },
      { finalReport: { overallScore: 90 }, completedAt: new Date('2026-02-01') },
    ]);

    mockRoadmapSelect.mockResolvedValue([
      {
        _id: 'roadmap1',
        targetRole: 'Backend Engineer',
        totalEstimatedDurationDays: 40,
        nodes: [{ status: 'completed' }, { status: 'not_started' }, { status: 'completed' }],
        updatedAt: new Date('2026-02-10'),
      },
    ]);

    mockPortfolioSelect.mockResolvedValue({
      isPublished: true,
      slug: 'janedoe',
      viewCount: 12,
      publishedAt: new Date('2026-02-15'),
    });
  });

  it('summarizes the latest resume analysis with the total analysis count', async () => {
    const result = await getDashboard('user1');
    expect(result.resume).toEqual({
      atsScore: 78,
      jobMatchScore: 82,
      analyzedAt: new Date('2026-01-01'),
      totalAnalyses: 3,
    });
  });

  it('summarizes the latest github analysis', async () => {
    const result = await getDashboard('user1');
    expect(result.github.estimatedSkillLevel).toBe('intermediate');
    expect(result.github.githubUsername).toBe('janedoe');
  });

  it('summarizes the career profile with a skill count derived from the skills array', async () => {
    const result = await getDashboard('user1');
    expect(result.careerProfile.overallReadinessLevel).toBe('developing');
    expect(result.careerProfile.skillCount).toBe(2);
  });

  it('computes correct average interview score and identifies the most recent one', async () => {
    const result = await getDashboard('user1');
    expect(result.interviews.totalCompleted).toBe(2);
    expect(result.interviews.averageScore).toBe(80); // (70+90)/2
    expect(result.interviews.lastInterviewAt).toEqual(new Date('2026-02-01'));
  });

  it('summarizes each roadmap with a computed node completion count', async () => {
    const result = await getDashboard('user1');
    expect(result.roadmaps.count).toBe(1);
    expect(result.roadmaps.items[0]).toMatchObject({
      targetRole: 'Backend Engineer',
      nodeCount: 3,
      completedNodeCount: 2,
    });
  });

  it('summarizes the portfolio publish status', async () => {
    const result = await getDashboard('user1');
    expect(result.portfolio).toEqual({
      isPublished: true,
      slug: 'janedoe',
      viewCount: 12,
      publishedAt: new Date('2026-02-15'),
    });
  });
});
