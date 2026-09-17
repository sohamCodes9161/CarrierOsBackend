import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../src/integrations/github.integration.js', () => ({
  fetchGithubUser: jest.fn().mockResolvedValue({
    login: 'janedoe',
    html_url: 'https://github.com/janedoe',
    bio: 'Backend engineer',
    followers: 42,
    following: 10,
    public_repos: 1,
    created_at: '2021-01-01T00:00:00Z',
  }),
  fetchUserRepos: jest.fn().mockResolvedValue([
    {
      name: 'payments-api',
      description: 'A payments backend',
      stargazers_count: 50,
      forks_count: 5,
      language: 'JavaScript',
      html_url: 'https://github.com/janedoe/payments-api',
      pushed_at: new Date().toISOString(),
      fork: false,
    },
  ]),
  fetchRepoLanguages: jest.fn().mockResolvedValue({ JavaScript: 9000, HTML: 1000 }),
  fetchRepoReadme: jest.fn().mockResolvedValue('# Payments API\nA robust payments backend.'),
  fetchUserPublicEvents: jest.fn().mockResolvedValue([
    { type: 'PushEvent', created_at: new Date().toISOString() },
  ]),
  fetchRepoRootContents: jest.fn().mockResolvedValue([
    { name: 'README.md', type: 'file' },
    { name: 'LICENSE', type: 'file' },
    { name: 'test', type: 'dir' },
  ]),
}));

jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: jest.fn().mockResolvedValue({
    summary: 'Solid backend-focused profile.',
    estimatedSkillLevel: 'intermediate',
    strengths: ['Consistent activity'],
    areasForImprovement: ['More project diversity'],
    inferredSkills: ['Node.js', 'Payments systems'],
    projectHighlights: [{ repoName: 'payments-api', whyItStandsOut: 'Well documented' }],
    activityAssessment: 'Active in the last week.',
  }),
}));

jest.unstable_mockModule('../src/models/GithubAnalysis.model.js', () => ({
  GithubAnalysis: {
    create: jest.fn().mockImplementation((doc) => Promise.resolve({ _id: 'gh-analysis-1', ...doc })),
  },
}));

const { analyzeGithubProfile } = await import('../src/services/github.service.js');
const { fetchRepoReadme } = await import('../src/integrations/github.integration.js');
const { generateStructuredContent } = await import('../src/integrations/groq.integration.js');
const { GithubAnalysis } = await import('../src/models/GithubAnalysis.model.js');

describe('analyzeGithubProfile (mocked integrations)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches the README for top repos and includes it in the AI prompt', async () => {
    await analyzeGithubProfile({ userId: 'user1', username: 'janedoe' });
    expect(fetchRepoReadme).toHaveBeenCalledWith('janedoe', 'payments-api');
    expect(generateStructuredContent).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Payments API'),
      })
    );
  });

  it('merges deterministic stats and AI result into one saved document', async () => {
    await analyzeGithubProfile({ userId: 'user1', username: 'janedoe' });
    expect(GithubAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user1',
        githubUsername: 'janedoe',
        totalStars: 50,
        estimatedSkillLevel: 'intermediate',
        commitCountLast30Days: 1,
        repoHealth: expect.arrayContaining([
          expect.objectContaining({ repoName: 'payments-api', hasReadme: true, hasLicense: true }),
        ]),
      })
    );
  });

  it('returns the created analysis', async () => {
    const result = await analyzeGithubProfile({ userId: 'user1', username: 'janedoe' });
    expect(result._id).toBe('gh-analysis-1');
  });
});
