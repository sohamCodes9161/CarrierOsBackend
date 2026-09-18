import { describe, it, expect } from '@jest/globals';
import { computePublishReadiness } from '../src/utils/portfolioReadiness.js';

describe('computePublishReadiness', () => {
  it('is ready when slug, headline, bio, and at least one project are present', () => {
    const result = computePublishReadiness({
      slug: 'janedoe',
      headline: 'Backend Engineer',
      bio: 'I build things.',
      projects: [{ title: 'A' }],
      experience: [],
    });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('is ready with at least one experience entry even with zero projects', () => {
    const result = computePublishReadiness({
      slug: 'janedoe',
      headline: 'Backend Engineer',
      bio: 'I build things.',
      projects: [],
      experience: [{ company: 'Acme' }],
    });
    expect(result.ready).toBe(true);
  });

  it('flags a missing slug', () => {
    const result = computePublishReadiness({
      slug: null,
      headline: 'x',
      bio: 'y',
      projects: [{ title: 'A' }],
      experience: [],
    });
    expect(result.ready).toBe(false);
    expect(result.missing.some((m) => m.includes('slug'))).toBe(true);
  });

  it('flags an empty-string headline as missing, not just an absent one', () => {
    const result = computePublishReadiness({
      slug: 'janedoe',
      headline: '   ',
      bio: 'y',
      projects: [{ title: 'A' }],
      experience: [],
    });
    expect(result.missing).toContain('headline');
  });

  it('flags missing content when there are zero projects AND zero experience entries', () => {
    const result = computePublishReadiness({
      slug: 'janedoe',
      headline: 'x',
      bio: 'y',
      projects: [],
      experience: [],
    });
    expect(result.ready).toBe(false);
    expect(result.missing.some((m) => m.includes('project or work experience'))).toBe(true);
  });

  it('lists every missing requirement at once, not just the first one found', () => {
    const result = computePublishReadiness({ slug: null, headline: '', bio: '', projects: [], experience: [] });
    expect(result.missing.length).toBe(4);
  });

  it('handles undefined projects/experience arrays without crashing', () => {
    const result = computePublishReadiness({ slug: 'janedoe', headline: 'x', bio: 'y' });
    expect(result.ready).toBe(false); // no content arrays present -> treated as empty
  });
});
