import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCareerProfileFindOne = jest.fn();
jest.unstable_mockModule('../src/models/CareerProfile.model.js', () => ({
  CareerProfile: { findOne: mockCareerProfileFindOne },
}));

const mockRoadmapFindOneAndUpdate = jest.fn();
const mockRoadmapFind = jest.fn();
const mockRoadmapFindById = jest.fn();
jest.unstable_mockModule('../src/models/Roadmap.model.js', () => ({
  Roadmap: {
    findOneAndUpdate: mockRoadmapFindOneAndUpdate,
    find: mockRoadmapFind,
    findById: mockRoadmapFindById,
  },
}));

const mockGenerateStructuredContent = jest.fn();
jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: mockGenerateStructuredContent,
}));

const { generateRoadmap, getRoadmapById, updateNodeStatus } = await import('../src/services/roadmap.service.js');
const { Roadmap } = await import('../src/models/Roadmap.model.js');

const fakeProfile = {
  _id: 'profile1',
  skills: [{ name: 'Node.js', sources: ['resume'] }],
  strengths: ['Clear communicator'],
  growthAreas: ['Needs more system design depth'],
};

const fakeAiNodes = {
  overallSummary: 'A focused roadmap to close the remaining gaps.',
  nodes: [
    {
      id: 'databases',
      title: 'Databases',
      description: 'Relational and NoSQL fundamentals',
      category: 'Databases',
      complexityTier: 'beginner',
      importance: 'core',
      prerequisiteIds: [],
      resources: [{ title: 'Intro to Databases', type: 'course', description: 'A beginner course' }],
      suggestedProjects: [{ title: 'Build a small CRUD app', description: 'Practice basic queries' }],
    },
    {
      id: 'system-design',
      title: 'System Design',
      description: 'Scaling and architecture fundamentals',
      category: 'Architecture',
      complexityTier: 'advanced',
      importance: 'core',
      prerequisiteIds: ['databases'],
      resources: [],
      suggestedProjects: [],
    },
  ],
};

describe('generateRoadmap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCareerProfileFindOne.mockResolvedValue(fakeProfile);
    mockGenerateStructuredContent.mockResolvedValue(fakeAiNodes);
    mockRoadmapFindOneAndUpdate.mockImplementation(async (filter, update) => ({ _id: 'roadmap1', ...update }));
  });

  it('throws BadRequestError when no career profile exists', async () => {
    mockCareerProfileFindOne.mockResolvedValue(null);
    await expect(
      generateRoadmap({ userId: 'user1', targetRole: 'Backend Engineer', targetSkills: [] })
    ).rejects.toThrow('Generate a career profile first');
    expect(mockGenerateStructuredContent).not.toHaveBeenCalled(); // fail-fast, no wasted AI call
  });

  it('computes the skill gap from explicit targetSkills against the profile', async () => {
    await generateRoadmap({
      userId: 'user1',
      targetRole: 'Backend Engineer',
      targetSkills: ['Node.js', 'Docker'],
    });

    const updatePayload = mockRoadmapFindOneAndUpdate.mock.calls[0][1];
    expect(updatePayload.skillGap.alreadyHave).toEqual(['Node.js']);
    expect(updatePayload.skillGap.missing).toEqual(['Docker']);
  });

  it('filters out an AI-proposed node that duplicates a known skill', async () => {
    mockGenerateStructuredContent.mockResolvedValue({
      overallSummary: 'summary',
      nodes: [
        { ...fakeAiNodes.nodes[0], id: 'node-js', title: 'Node.js' }, // duplicates a known skill
        fakeAiNodes.nodes[1],
      ],
    });

    await generateRoadmap({ userId: 'user1', targetRole: 'Backend Engineer', targetSkills: [] });

    const updatePayload = mockRoadmapFindOneAndUpdate.mock.calls[0][1];
    const nodeIds = updatePayload.nodes.map((n) => n.id);
    expect(nodeIds).not.toContain('node-js');
  });

  it('processes AI nodes through the deterministic graph builder (learningOrder assigned)', async () => {
    await generateRoadmap({ userId: 'user1', targetRole: 'Backend Engineer', targetSkills: [] });

    const updatePayload = mockRoadmapFindOneAndUpdate.mock.calls[0][1];
    const databases = updatePayload.nodes.find((n) => n.id === 'databases');
    const systemDesign = updatePayload.nodes.find((n) => n.id === 'system-design');
    expect(databases.learningOrder).toBeLessThan(systemDesign.learningOrder);
    expect(updatePayload.totalEstimatedDurationDays).toBeGreaterThan(0);
  });

  it('upserts using {user, targetRoleKey} as the filter, not fetch-then-save', async () => {
    await generateRoadmap({ userId: 'user1', targetRole: '  Backend Engineer  ', targetSkills: [] });

    expect(mockRoadmapFindOneAndUpdate).toHaveBeenCalledWith(
      { user: 'user1', targetRoleKey: 'backend engineer' },
      expect.objectContaining({ targetRole: '  Backend Engineer  ' }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });
});

describe('getRoadmapById', () => {
  it('throws NotFoundError when the roadmap does not exist', async () => {
    mockRoadmapFindById.mockResolvedValue(null);
    await expect(getRoadmapById({ roadmapId: 'x', userId: 'user1' })).rejects.toThrow('not found');
  });

  it('throws ForbiddenError when the roadmap belongs to a different user', async () => {
    mockRoadmapFindById.mockResolvedValue({ _id: 'r1', user: { toString: () => 'someone-else' } });
    await expect(getRoadmapById({ roadmapId: 'r1', userId: 'user1' })).rejects.toThrow('do not have access');
  });

  it('returns the roadmap when it exists and belongs to the user', async () => {
    mockRoadmapFindById.mockResolvedValue({ _id: 'r1', user: { toString: () => 'user1' } });
    const result = await getRoadmapById({ roadmapId: 'r1', userId: 'user1' });
    expect(result._id).toBe('r1');
  });
});

describe('updateNodeStatus', () => {
  it('throws NotFoundError when the node id does not exist on the roadmap', async () => {
    mockRoadmapFindById.mockResolvedValue({
      _id: 'r1',
      user: { toString: () => 'user1' },
      nodes: [{ id: 'databases' }],
    });
    await expect(
      updateNodeStatus({ roadmapId: 'r1', userId: 'user1', nodeId: 'does-not-exist', status: 'completed' })
    ).rejects.toThrow('No node with id');
  });

  it('uses an atomic findOneAndUpdate targeting the specific node, not fetch-then-save', async () => {
    mockRoadmapFindById.mockResolvedValue({
      _id: 'r1',
      user: { toString: () => 'user1' },
      nodes: [{ id: 'databases' }],
    });
    Roadmap.findOneAndUpdate.mockResolvedValue({ _id: 'r1' });

    await updateNodeStatus({ roadmapId: 'r1', userId: 'user1', nodeId: 'databases', status: 'completed' });

    expect(Roadmap.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'r1', 'nodes.id': 'databases' },
      { $set: { 'nodes.$.status': 'completed' } },
      { new: true }
    );
  });
});
