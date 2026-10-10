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
import { uploadBufferToCloudinary } from '../integrations/cloudinary.integration.js';

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
  if (Object.keys($set).length > 0) updateDoc.$set =$set;

  return Portfolio.findOneAndUpdate({ user: userId }, updateDoc, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

export async function quickStart(userId) {
  const [careerProfile, githubAnalysis] = await Promise.all([
    CareerProfile.findOne({ user: userId }),
    GithubAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }),
  ]);

  if (!careerProfile && !githubAnalysis) {
    throw new BadRequestError('Generate a career profile or GitHub analysis first to use quick-start.');
  }

  const portfolio = await getOrCreatePortfolioDoc(userId);

  // --- NEW AI SKILL CURATION LOGIC ---
  if (careerProfile) {
    const rawSkills = careerProfile.skills.map((s) => s.name);

    const prompt = `You are an expert technical recruiter. Curate this list of skills down to a maximum of 15-20 high-impact, core technologies. 
    Remove highly granular, redundant, or overly basic terms (e.g., remove 'array', 'npm', 'Functional Components', 'OOP', 'HTML5').
    Keep primary languages, frameworks, and databases (e.g., 'React.js', 'Node.js', 'MongoDB', 'C++').
    Do not invent new skills. Only use skills from the provided list.
    
    Raw skills: ${rawSkills.join(', ')}`;

    const curatedSkillsSchema = {
      type: "object",
      properties: {
        skills: {
          type: "array",
          items: { type: "string" },
          description: "An array of 15-20 curated, high-level technical skills."
        }
      },
      required: ["skills"]
    };

    try {
      const aiResponse = await generateStructuredContent({
        prompt,
        responseSchema: curatedSkillsSchema,
        schemaName: 'CuratedSkills'
      });
      
      portfolio.skills = mergeSkillsDedup(portfolio.skills, aiResponse.skills);
    } catch (error) {
      console.error("AI Skill Curation failed, falling back to basic slice:", error);
      portfolio.skills = mergeSkillsDedup(portfolio.skills, rawSkills.slice(0, 15));
    }
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
    { $set: { slug },$setOnInsert: { user: userId } },
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
    profilePhotoUrl: portfolio.profilePhotoUrl,
  };
}

export async function improveContent({ section, text }) {
  const prompt = buildPortfolioContentPrompt({ section, text });
  return generateStructuredContent({
    prompt,
    responseSchema: portfolioContentSchema,
    schemaName: portfolioContentSchemaName,
  });
}

export async function uploadProfilePhoto(userId, file) {
  const portfolio = await getOrCreatePortfolioDoc(userId);
  const uploadResult = await uploadBufferToCloudinary(file.buffer, {
    folder: 'portfolio_profiles',
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
  });

  portfolio.profilePhotoUrl = uploadResult.secure_url;
  await portfolio.save();
  return portfolio;
}

export async function curatePortfolioSkills(userId) {
  const portfolio = await getOrCreatePortfolioDoc(userId);
  if (!portfolio.skills || portfolio.skills.length === 0) {
    return portfolio;
  }

  const prompt = `You are a technical recruiter. Filter and curate this list of skills down to a maximum of 15-20 core, high-impact technologies.
  Remove overly granular concepts, redundant terms, or basic fundamentals (e.g., remove 'array', 'npm', 'HTML5', 'Functional Components', 'CRUD Operations', 'Async/Await').
  Keep primary languages, frameworks, databases, and key tools (e.g., 'React.js', 'Node.js', 'MongoDB', 'C++', 'Tailwind CSS', 'Docker').
  Do NOT add new skills. Return ONLY a subset of the input array.

  Input skills: ${portfolio.skills.join(', ')}`;

  const responseSchema = {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Curated list of 15-20 essential skills.'
      }
    },
    required: ['skills']
  };

  try {
    const aiResponse = await generateStructuredContent({
      prompt,
      responseSchema,
      schemaName: 'CuratedSkillsResult'
    });
    portfolio.skills = aiResponse.skills;
    await portfolio.save();
  } catch (err) {
    console.error('Skill curation failed:', err);
  }

  return portfolio;
}