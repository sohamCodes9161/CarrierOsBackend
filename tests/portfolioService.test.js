import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockPortfolioFindOne = jest.fn();
const mockPortfolioCreate = jest.fn();
const mockPortfolioFindOneAndUpdate = jest.fn();

jest.unstable_mockModule('../src/models/Portfolio.model.js', () => ({
  Portfolio: {
    findOne: mockPortfolioFindOne,
    create: mockPortfolioCreate,
    findOneAndUpdate: mockPortfolioFindOneAndUpdate,
  },
}));

const mockCareerProfileFindOne = jest.fn();
jest.unstable_mockModule('../src/models/CareerProfile.model.js', () => ({
  CareerProfile: { findOne: mockCareerProfileFindOne },
}));

const mockGithubFindOne = jest.fn();
const mockGithubSort = jest.fn();
jest.unstable_mockModule('../src/models/GithubAnalysis.model.js', () => ({
  GithubAnalysis: { findOne: jest.fn(() => ({ sort: mockGithubSort })) },
}));

jest.unstable_mockModule('../src/integrations/groq.integration.js', () => ({
  generateStructuredContent: jest.fn().mockResolvedValue({
    improvedText: 'A polished version.',
    changesSummary: 'Tightened the wording.',
  }),
}));

const portfolioService = await import('../src/services/portfolio.service.js');

/** Builds a fake portfolio object realistic enough for the service logic
 * under test - section arrays support .id() lookup and .push(), and the
 * whole object has a working .save(). */
function fakePortfolio(overrides = {}) {
  const doc = {
    _id: 'portfolio1',
    user: 'user1',
    slug: null,
    isPublished: false,
    publishedAt: null,
    headline: '',
    bio: '',
    contact: {},
    skills: [],
    projects: [],
    experience: [],
    education: [],
    achievements: [],
    templateId: 'minimal',
    themeColor: null,
    viewCount: 0,
    ...overrides,
  };
  for (const section of ['projects', 'experience', 'education', 'achievements']) {
    doc[section].id = (id) => doc[section].find((i) => i._id === id) || null;
  }
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
}

describe('quickStart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws BadRequestError when neither career profile nor github analysis exists', async () => {
    mockCareerProfileFindOne.mockResolvedValue(null);
    mockGithubSort.mockResolvedValue(null);
    await expect(portfolioService.quickStart('user1')).rejects.toThrow(
      'Generate a career profile or GitHub analysis first'
    );
  });

  it('pulls skill names from the career profile into the portfolio, deduped', async () => {
    mockCareerProfileFindOne.mockResolvedValue({
      skills: [{ name: 'Node.js' }, { name: 'MongoDB' }],
    });
    mockGithubSort.mockResolvedValue(null);
    const existing = fakePortfolio({ skills: ['Node.js'] }); // already has Node.js
    mockPortfolioFindOne.mockResolvedValue(existing);

    const result = await portfolioService.quickStart('user1');
    expect(result.skills).toEqual(['Node.js', 'MongoDB']); // no duplicate
  });

  it('pulls top GitHub repos into projects, capped at 5', async () => {
    mockCareerProfileFindOne.mockResolvedValue(null);
    const topRepos = Array.from({ length: 8 }, (_, i) => ({
      name: `repo-${i}`,
      description: `desc ${i}`,
      language: 'JavaScript',
      url: `https://github.com/jane/repo-${i}`,
    }));
    mockGithubSort.mockResolvedValue({ topRepos });
    const existing = fakePortfolio();
    mockPortfolioFindOne.mockResolvedValue(existing);

    const result = await portfolioService.quickStart('user1');
    expect(result.projects).toHaveLength(5);
  });

  it('does not duplicate projects when quick-start is run twice', async () => {
    mockCareerProfileFindOne.mockResolvedValue(null);
    const topRepos = [{ name: 'repo-a', description: 'x', language: 'JS', url: 'https://github.com/jane/repo-a' }];
    mockGithubSort.mockResolvedValue({ topRepos });

    const existing = fakePortfolio({
      projects: [{ _id: 'p1', title: 'repo-a', githubUrl: 'https://github.com/jane/repo-a', order: 0 }],
    });
    mockPortfolioFindOne.mockResolvedValue(existing);

    const result = await portfolioService.quickStart('user1');
    expect(result.projects).toHaveLength(1); // not duplicated
  });
});

describe('addSectionItem / updateSectionItem / deleteSectionItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends a new item to the section with the correct order value', async () => {
    const portfolio = fakePortfolio({ projects: [{ _id: 'p1', title: 'Existing', order: 0 }] });
    portfolio.projects.id = (id) => portfolio.projects.find((i) => i._id === id) || null;
    mockPortfolioFindOne.mockResolvedValue(portfolio);
    mockPortfolioCreate.mockResolvedValue(portfolio);

    const result = await portfolioService.addSectionItem({
      userId: 'user1',
      section: 'projects',
      itemData: { title: 'New Project' },
    });

    expect(result.projects).toHaveLength(2);
    expect(result.projects[1].order).toBe(1);
  });

  it('rejects an invalid section name', async () => {
    await expect(
      portfolioService.addSectionItem({ userId: 'user1', section: 'not-a-real-section', itemData: {} })
    ).rejects.toThrow('Invalid portfolio section');
  });

  it('updates an existing item by id', async () => {
    const portfolio = fakePortfolio({ projects: [{ _id: 'p1', title: 'Old Title', order: 0 }] });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    const result = await portfolioService.updateSectionItem({
      userId: 'user1',
      section: 'projects',
      itemId: 'p1',
      updates: { title: 'New Title' },
    });

    expect(result.projects[0].title).toBe('New Title');
  });

  it('throws NotFoundError when updating a nonexistent item id', async () => {
    const portfolio = fakePortfolio({ projects: [{ _id: 'p1', title: 'X', order: 0 }] });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    await expect(
      portfolioService.updateSectionItem({ userId: 'user1', section: 'projects', itemId: 'nope', updates: {} })
    ).rejects.toThrow('No projects item with id');
  });

  it('removes an item via deleteOne on the subdocument', async () => {
    const portfolio = fakePortfolio({ projects: [{ _id: 'p1', title: 'X', order: 0 }] });
    portfolio.projects[0].deleteOne = () => {
      portfolio.projects = portfolio.projects.filter((i) => i._id !== 'p1');
    };
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    await portfolioService.deleteSectionItem({ userId: 'user1', section: 'projects', itemId: 'p1' });
    expect(portfolio.projects).toHaveLength(0);
  });
});

describe('reorderSectionItems', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reassigns order values to match the given sequence', async () => {
    const portfolio = fakePortfolio({
      projects: [
        { _id: 'a', title: 'A', order: 0 },
        { _id: 'b', title: 'B', order: 1 },
      ],
    });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    const result = await portfolioService.reorderSectionItems({
      userId: 'user1',
      section: 'projects',
      orderedIds: ['b', 'a'],
    });

    expect(result.projects.find((i) => i._id === 'b').order).toBe(0);
    expect(result.projects.find((i) => i._id === 'a').order).toBe(1);
  });

  it('rejects a reorder list with a missing item', async () => {
    const portfolio = fakePortfolio({
      projects: [
        { _id: 'a', title: 'A', order: 0 },
        { _id: 'b', title: 'B', order: 1 },
      ],
    });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    await expect(
      portfolioService.reorderSectionItems({ userId: 'user1', section: 'projects', orderedIds: ['a'] })
    ).rejects.toThrow('orderedIds must include exactly');
  });

  it('rejects a reorder list with an id that does not belong to this section', async () => {
    const portfolio = fakePortfolio({ projects: [{ _id: 'a', title: 'A', order: 0 }] });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    await expect(
      portfolioService.reorderSectionItems({ userId: 'user1', section: 'projects', orderedIds: ['not-real'] })
    ).rejects.toThrow('orderedIds must include exactly');
  });
});

describe('publishPortfolio', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequestError with the specific missing fields when not ready', async () => {
    const portfolio = fakePortfolio({ slug: null, headline: '', bio: '' });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    await expect(portfolioService.publishPortfolio('user1')).rejects.toThrow('slug');
  });

  it('publishes successfully when all requirements are met', async () => {
    const portfolio = fakePortfolio({
      slug: 'janedoe',
      headline: 'Backend Engineer',
      bio: 'I build things.',
      projects: [{ _id: 'p1', title: 'X', order: 0 }],
    });
    mockPortfolioFindOne.mockResolvedValue(portfolio);

    const result = await portfolioService.publishPortfolio('user1');
    expect(result.isPublished).toBe(true);
    expect(result.publishedAt).not.toBeNull();
  });
});

describe('updateSlug', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid slug format', async () => {
    await expect(portfolioService.updateSlug({ userId: 'user1', slug: 'ab' })).rejects.toThrow('3-40 characters');
  });

  it('rejects a reserved slug', async () => {
    await expect(portfolioService.updateSlug({ userId: 'user1', slug: 'admin' })).rejects.toThrow('reserved');
  });

  it('rejects a slug already taken by a different user', async () => {
    mockPortfolioFindOne.mockResolvedValue({ user: { toString: () => 'someone-else' } });
    await expect(portfolioService.updateSlug({ userId: 'user1', slug: 'janedoe' })).rejects.toThrow('already taken');
  });

  it('allows a user to re-set their own current slug (not a conflict with self)', async () => {
    mockPortfolioFindOne.mockResolvedValue({ user: { toString: () => 'user1' } });
    mockPortfolioFindOneAndUpdate.mockResolvedValue({ slug: 'janedoe' });

    const result = await portfolioService.updateSlug({ userId: 'user1', slug: 'janedoe' });
    expect(result.slug).toBe('janedoe');
  });
});

describe('checkSlugAvailability', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns unavailable with reason for invalid format', async () => {
    const result = await portfolioService.checkSlugAvailability('ab');
    expect(result).toEqual({ available: false, reason: 'invalid_format' });
  });

  it('returns unavailable with reason for a reserved word', async () => {
    const result = await portfolioService.checkSlugAvailability('admin');
    expect(result).toEqual({ available: false, reason: 'reserved' });
  });

  it('returns unavailable when already taken', async () => {
    mockPortfolioFindOne.mockResolvedValue({ slug: 'janedoe' });
    const result = await portfolioService.checkSlugAvailability('janedoe');
    expect(result).toEqual({ available: false, reason: 'taken' });
  });

  it('returns available when the slug is free and valid', async () => {
    mockPortfolioFindOne.mockResolvedValue(null);
    const result = await portfolioService.checkSlugAvailability('janedoe');
    expect(result).toEqual({ available: true });
  });
});

describe('getPublicPortfolioBySlug', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundError when the slug does not exist', async () => {
    mockPortfolioFindOneAndUpdate.mockResolvedValue(null);
    await expect(portfolioService.getPublicPortfolioBySlug('nonexistent')).rejects.toThrow('not found');
  });

  it('throws the SAME NotFoundError message for an unpublished portfolio as a nonexistent one', async () => {
    // The query filter itself requires isPublished:true, so an unpublished
    // portfolio simply won't match - this proves both cases produce
    // identical findOneAndUpdate behavior (null), and thus identical errors.
    mockPortfolioFindOneAndUpdate.mockResolvedValue(null);
    let unpublishedError;
    let nonexistentError;
    try {
      await portfolioService.getPublicPortfolioBySlug('unpublished-one');
    } catch (e) {
      unpublishedError = e.message;
    }
    try {
      await portfolioService.getPublicPortfolioBySlug('does-not-exist');
    } catch (e) {
      nonexistentError = e.message;
    }
    expect(unpublishedError).toBe(nonexistentError);
  });

  it('only returns the explicitly allow-listed fields, never internal ones', async () => {
    mockPortfolioFindOneAndUpdate.mockResolvedValue({
      _id: 'internal-id',
      user: 'internal-user-id',
      slug: 'janedoe',
      headline: 'Backend Engineer',
      bio: 'I build things.',
      contact: { email: 'jane@example.com' },
      skills: ['Node.js'],
      projects: [],
      experience: [],
      education: [],
      achievements: [],
      templateId: 'minimal',
      themeColor: null,
      viewCount: 999,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
    });

    const result = await portfolioService.getPublicPortfolioBySlug('janedoe');

    expect(result._id).toBeUndefined();
    expect(result.user).toBeUndefined();
    expect(result.viewCount).toBeUndefined();
    expect(result.isPublished).toBeUndefined();
    expect(result.createdAt).toBeUndefined();
    expect(result.slug).toBe('janedoe');
    expect(result.headline).toBe('Backend Engineer');
  });

  it('atomically increments the view count via $inc in the same query', async () => {
    mockPortfolioFindOneAndUpdate.mockResolvedValue({
      slug: 'janedoe',
      headline: '',
      bio: '',
      contact: {},
      skills: [],
      projects: [],
      experience: [],
      education: [],
      achievements: [],
      templateId: 'minimal',
      themeColor: null,
      publishedAt: null,
    });

    await portfolioService.getPublicPortfolioBySlug('janedoe');

    expect(mockPortfolioFindOneAndUpdate).toHaveBeenCalledWith(
      { slug: 'janedoe', isPublished: true },
      { $inc: { viewCount: 1 } },
      expect.objectContaining({ new: false })
    );
  });
});

describe('improveContent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the AI-suggested text without touching the database', async () => {
    const result = await portfolioService.improveContent({ section: 'bio', text: 'I code stuff.' });
    expect(result.improvedText).toBe('A polished version.');
    expect(mockPortfolioFindOne).not.toHaveBeenCalled();
    expect(mockPortfolioFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
