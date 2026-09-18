import * as portfolioService from '../services/portfolio.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getOwnPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.getPortfolio(req.userId);
  sendSuccess(res, { data: { portfolio } });
});

export const updatePortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.updatePortfolio({ userId: req.userId, updates: req.body });
  sendSuccess(res, { message: 'Portfolio updated', data: { portfolio } });
});

export const quickStart = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.quickStart(req.userId);
  sendSuccess(res, { message: 'Portfolio pre-filled from your existing data', data: { portfolio } });
});

export const getPublishReadiness = asyncHandler(async (req, res) => {
  const readiness = await portfolioService.getPublishReadiness(req.userId);
  sendSuccess(res, { data: readiness });
});

export const publish = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.publishPortfolio(req.userId);
  sendSuccess(res, { message: 'Portfolio published', data: { portfolio } });
});

export const unpublish = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.unpublishPortfolio(req.userId);
  sendSuccess(res, { message: 'Portfolio unpublished', data: { portfolio } });
});

export const updateSlug = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.updateSlug({ userId: req.userId, slug: req.body.slug });
  sendSuccess(res, { message: 'Slug updated', data: { portfolio } });
});

export const checkSlugAvailability = asyncHandler(async (req, res) => {
  const result = await portfolioService.checkSlugAvailability(req.params.slug.toLowerCase());
  sendSuccess(res, { data: result });
});

export const improveContent = asyncHandler(async (req, res) => {
  const result = await portfolioService.improveContent({ section: req.body.section, text: req.body.text });
  sendSuccess(res, { data: result });
});

export const getPublicPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.getPublicPortfolioBySlug(req.params.slug.toLowerCase());
  sendSuccess(res, { data: { portfolio } });
});

// --- Section CRUD: projects / experience / education / achievements ---

function makeSectionHandlers(section) {
  return {
    add: asyncHandler(async (req, res) => {
      const portfolio = await portfolioService.addSectionItem({ userId: req.userId, section, itemData: req.body });
      sendSuccess(res, { statusCode: 201, message: `${section} item added`, data: { portfolio } });
    }),
    update: asyncHandler(async (req, res) => {
      const portfolio = await portfolioService.updateSectionItem({
        userId: req.userId,
        section,
        itemId: req.params.itemId,
        updates: req.body,
      });
      sendSuccess(res, { message: `${section} item updated`, data: { portfolio } });
    }),
    remove: asyncHandler(async (req, res) => {
      const portfolio = await portfolioService.deleteSectionItem({
        userId: req.userId,
        section,
        itemId: req.params.itemId,
      });
      sendSuccess(res, { message: `${section} item removed`, data: { portfolio } });
    }),
    reorder: asyncHandler(async (req, res) => {
      const portfolio = await portfolioService.reorderSectionItems({
        userId: req.userId,
        section,
        orderedIds: req.body.orderedIds,
      });
      sendSuccess(res, { message: `${section} reordered`, data: { portfolio } });
    }),
  };
}

export const projects = makeSectionHandlers('projects');
export const experience = makeSectionHandlers('experience');
export const education = makeSectionHandlers('education');
export const achievements = makeSectionHandlers('achievements');
