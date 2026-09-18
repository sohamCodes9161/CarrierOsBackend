import { Portfolio } from '../models/Portfolio.model.js';
import { CareerProfile } from '../models/CareerProfile.model.js';
import { GithubAnalysis } from '../models/GithubAnalysis.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import {
  buildPortfolioContentPrompt,
  portfolioContentSchema,
  portfolioContentSchemaName,
} from '../integrations/prompts/portfolioContent.prompt.js';
import { isValidSlugFormat, isReservedSlug, mergeSkillsDedup, mergeProjectsDedup } from '../utils/portfolioSlug.js';
import { computePublishReadiness } from '../utils/portfolioReadiness.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../errors/AppError.js';

const VALID_SECTIONS = new Set(['projects', 'experience', 'education', 'achievements']);

function assertValidSection(section) {
  if (!VALID_SECTIONS.has(section)) {
    throw new BadRequestError(`Invalid portfolio section: ${section}`);
  }
}

async function getOrCreatePortfolioDoc(userId) {
  let portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) {
    portfolio = await Portfolio.create({ user: userId });
  }
  return portfolio;
}

export async function getPortfolio(userId) {
  return getOrCreatePortfolioDoc(userId);
}

export async function updatePortfolio({ userId, updates }) {
  const $set = {};
  if (updates.headline !== undefined) $set.headline = updates.headline;
  if (updates.bio !== undefined) $set.bio = updates.bio;
  if (updates.skills !== undefined) $set.skills = updates.skills;
  if (updates.templateId !== undefined) $set.templateId = updates.templateId;
  if (updates.themeColor !== undefined) $set.themeColor = updates.themeColor;
  if (updates.contact) {
    for (const [key, value] of Object.entries(updates.contact)) {
      if (value !== undefined) $set[`contact.${key}`] = value;
    }
  }

  const updateDoc = { $setOnInsert: { user: userId } };
  if (Object.keys($set).length > 0) updateDoc.$set = $set;

  return Portfolio.findOneAndUpdate({ user: userId }, updateDoc, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/**
 * Pre-fills skills (from Career Profile) and suggested projects (from top
 * GitHub repos) into the portfolio. Deduplicated against existing content,
 * so this is safe to call more than once - it won't create duplicate
 * skills or re-add the same repo as a project on a second run.
 */
export async function quickStart(userId) {
  const [careerProfile, githubAnalysis] = await Promise.all([
    CareerProfile.findOne({ user: userId }),
    GithubAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }),
  ]);

  if (!careerProfile && !githubAnalysis) {
    throw new BadRequestError('Generate a career profile or GitHub analysis first to use quick-start.');
  }

  const portfolio = await getOrCreatePortfolioDoc(userId);

  if (careerProfile) {
    const suggestedSkills = careerProfile.skills.map((s) => s.name);
    portfolio.skills = mergeSkillsDedup(portfolio.skills, suggestedSkills);
  }

  if (githubAnalysis?.topRepos?.length > 0) {
    const suggestedProjects = githubAnalysis.topRepos.slice(0, 5).map((repo, i) => ({
      title: repo.name,
      description: repo.description || `A ${repo.language || 'software'} project.`,
      techStack: repo.language ? [repo.language] : [],
      githubUrl: repo.url,
      liveUrl: '',
      imageUrl: '',
      featured: i < 3,
    }));
    portfolio.projects = mergeProjectsDedup(portfolio.projects, suggestedProjects);
  }

  await portfolio.save();
  return portfolio;
}

// --- Generic section CRUD (projects / experience / education / achievements) ---

export async function addSectionItem({ userId, section, itemData }) {
  assertValidSection(section);
  const portfolio = await getOrCreatePortfolioDoc(userId);
  const order = portfolio[section].length;
  portfolio[section].push({ ...itemData, order });
  await portfolio.save();
  return portfolio;
}

export async function updateSectionItem({ userId, section, itemId, updates }) {
  assertValidSection(section);
  const portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) throw new NotFoundError('Portfolio not found');

  const item = portfolio[section].id(itemId);
  if (!item) throw new NotFoundError(`No ${section} item with id "${itemId}"`);

  Object.assign(item, updates);
  await portfolio.save();
  return portfolio;
}

export async function deleteSectionItem({ userId, section, itemId }) {
  assertValidSection(section);
  const portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) throw new NotFoundError('Portfolio not found');

  const item = portfolio[section].id(itemId);
  if (!item) throw new NotFoundError(`No ${section} item with id "${itemId}"`);

  item.deleteOne();
  await portfolio.save();
  return portfolio;
}

export async function reorderSectionItems({ userId, section, orderedIds }) {
  assertValidSection(section);
  const portfolio = await Portfolio.findOne({ user: userId });
  if (!portfolio) throw new NotFoundError('Portfolio not found');

  const idToItem = new Map(portfolio[section].map((item) => [item._id.toString(), item]));
  const isValidReorder =
    orderedIds.length === portfolio[section].length && orderedIds.every((id) => idToItem.has(id));
  if (!isValidReorder) {
    throw new BadRequestError('orderedIds must include exactly the current items in this section, each exactly once');
  }

  orderedIds.forEach((id, index) => {
    idToItem.get(id).order = index;
  });

  await portfolio.save();
  return portfolio;
}

// --- Publish flow ---

export async function getPublishReadiness(userId) {
  const portfolio = await getOrCreatePortfolioDoc(userId);
  return computePublishReadiness(portfolio);
}

export async function publishPortfolio(userId) {
  const portfolio = await getOrCreatePortfolioDoc(userId);
  const readiness = computePublishReadiness(portfolio);
  if (!readiness.ready) {
    throw new BadRequestError(`Portfolio is not ready to publish. Missing: ${readiness.missing.join(', ')}`);
  }

  portfolio.isPublished = true;
  portfolio.publishedAt = new Date();
  await portfolio.save();
  return portfolio;
}

export async function unpublishPortfolio(userId) {
  const portfolio = await Portfolio.findOneAndUpdate(
    { user: userId },
    { $set: { isPublished: false } },
    { new: true }
  );
  if (!portfolio) throw new NotFoundError('Portfolio not found');
  return portfolio;
}

// --- Slug management ---

export async function updateSlug({ userId, slug }) {
  if (!isValidSlugFormat(slug)) {
    throw new BadRequestError(
      'Slug must be 3-40 characters, lowercase letters/numbers/hyphens only, no leading/trailing or consecutive hyphens.'
    );
  }
  if (isReservedSlug(slug)) {
    throw new BadRequestError('This slug is reserved and cannot be used.');
  }

  const existing = await Portfolio.findOne({ slug });
  if (existing && existing.user.toString() !== userId) {
    throw new ConflictError('This slug is already taken.');
  }

  return Portfolio.findOneAndUpdate(
    { user: userId },
    { $set: { slug }, $setOnInsert: { user: userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function checkSlugAvailability(slug) {
  if (!isValidSlugFormat(slug)) {
    return { available: false, reason: 'invalid_format' };
  }
  if (isReservedSlug(slug)) {
    return { available: false, reason: 'reserved' };
  }
  const existing = await Portfolio.findOne({ slug });
  return existing ? { available: false, reason: 'taken' } : { available: true };
}

// --- Public access ---

/**
 * Fetches a published portfolio by slug for public (unauthenticated)
 * viewing. Returns the exact same "not found" error whether the slug
 * doesn't exist at all or simply isn't published - never reveals which,
 * to avoid leaking the existence of a draft portfolio.
 *
 * Fields are selected explicitly rather than returning the raw document,
 * so internal fields (user id, view count, timestamps) can never leak
 * through this public endpoint even if the schema grows later.
 */
export async function getPublicPortfolioBySlug(slug) {
  const portfolio = await Portfolio.findOneAndUpdate(
    { slug, isPublished: true },
    { $inc: { viewCount: 1 } },
    { new: false }
  );

  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }

  return {
    slug: portfolio.slug,
    headline: portfolio.headline,
    bio: portfolio.bio,
    contact: portfolio.contact,
    skills: portfolio.skills,
    projects: portfolio.projects,
    experience: portfolio.experience,
    education: portfolio.education,
    achievements: portfolio.achievements,
    templateId: portfolio.templateId,
    themeColor: portfolio.themeColor,
    publishedAt: portfolio.publishedAt,
  };
}

// --- AI content improvement (suggest-only, never auto-applied) ---

export async function improveContent({ section, text }) {
  const prompt = buildPortfolioContentPrompt({ section, text });
  return generateStructuredContent({
    prompt,
    responseSchema: portfolioContentSchema,
    schemaName: portfolioContentSchemaName,
  });
}
