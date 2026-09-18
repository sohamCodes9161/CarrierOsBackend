import { describe, it, expect } from '@jest/globals';
import { buildPortfolioContentPrompt } from '../src/integrations/prompts/portfolioContent.prompt.js';

describe('buildPortfolioContentPrompt', () => {
  it('includes the original text', () => {
    const prompt = buildPortfolioContentPrompt({ section: 'bio', text: 'UNIQUE_ORIGINAL_TEXT' });
    expect(prompt).toContain('UNIQUE_ORIGINAL_TEXT');
  });

  it('instructs the model not to invent facts', () => {
    const prompt = buildPortfolioContentPrompt({ section: 'bio', text: 'x' });
    expect(prompt.toLowerCase()).toContain('do not invent facts');
  });

  it('gives section-specific guidance for a project description', () => {
    const prompt = buildPortfolioContentPrompt({ section: 'project', text: 'x' });
    expect(prompt.toLowerCase()).toContain('project description');
  });

  it('gives section-specific guidance for a headline', () => {
    const prompt = buildPortfolioContentPrompt({ section: 'headline', text: 'x' });
    expect(prompt.toLowerCase()).toContain('headline');
  });

  it('falls back to generic guidance for an unrecognized section rather than crashing', () => {
    const prompt = buildPortfolioContentPrompt({ section: 'unknown-section', text: 'x' });
    expect(prompt).toContain('a section of their portfolio');
  });
});
