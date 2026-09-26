import fetch from 'node-fetch';
import { env } from '../config/env.js';

/**
 * Common tech skills dictionary to extract required skills from raw job descriptions
 */
const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Node.js', 'Express', 'React', 'Vue', 'Angular',
  'Python', 'Django', 'Flask', 'Java', 'Spring', 'C++', 'C#', '.NET', 'Go',
  'Rust', 'PHP', 'Laravel', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'GraphQL', 'REST', 'Git',
  'CI/CD', 'Tailwind', 'Bootstrap', 'HTML', 'CSS', 'System Design'
];

/**
 * Escapes special regex characters (+, #, ., *, ?, ^, $, etc.)
 */
function escapeRegExp(string = '') {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts tech skills mentioned in a job description string safely
 */
const extractSkillsFromText = (text = '') => {
  if (!text) return [];
  const lowerText = text.toLowerCase();

  return KNOWN_SKILLS.filter((skill) => {
    const escaped = escapeRegExp(skill);
    
    // If skill ends with non-word char (like C++, C#), don't use trailing \b
    const startsWithWordChar = /^\w/.test(skill);
    const endsWithWordChar = /\w$/.test(skill);

    const leadingBoundary = startsWithWordChar ? '\\b' : '(?:^|\\s)';
    const trailingBoundary = endsWithWordChar ? '\\b' : '(?:$|\\s|[^a-zA-Z0-9])';

    const regex = new RegExp(`${leadingBoundary}${escaped}${trailingBoundary}`, 'i');
    return regex.test(lowerText);
  });
};

/**
 * Fetches live job listings from Adzuna API using centralized env config
 */
export const fetchAdzunaJobs = async (searchQuery, location = '') => {
  const appId = env.ADZUNA_APP_ID;
  const appKey = env.ADZUNA_APP_KEY;
  const country = env.ADZUNA_COUNTRY || 'in';

  if (!appId || !appKey) {
    return null; // Signals fallback to Remotive/DB if Adzuna API keys aren't set
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=10&what=${encodeURIComponent(
    searchQuery
  )}${location ? `&where=${encodeURIComponent(location)}` : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();

    return (data.results || []).map((job) => {
      const extractedSkills = extractSkillsFromText(`${job.title} ${job.description}`);

      return {
        _id: `ext_adzuna_${job.id}`,
        company: job.company?.display_name || 'Unknown Company',
        title: job.title.replace(/<\/?[^>]+(>|$)/g, ''), // Strip HTML tags
        description: job.description || '',
        requiredSkills: extractedSkills.length > 0 ? extractedSkills : ['JavaScript', 'Node.js'],
        location: job.location?.display_name || 'Remote',
        workplaceType: 'hybrid',
        employmentType: 'full-time',
        salary: {
          min: job.salary_min || 0,
          max: job.salary_max || 0,
          currency: 'INR',
        },
        jobUrl: job.redirect_url,
        isExternal: true,
      };
    });
  } catch (error) {
    console.error('Adzuna API Fetch Error:', error.message);
    return null;
  }
};

/**
 * Free fallback: Remotive API (No API key required)
 */
export const fetchRemotiveJobs = async (searchQuery) => {
  try {
    const response = await fetch(
      `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(searchQuery)}&limit=10`
    );
    if (!response.ok) return [];

    const data = await response.json();

    return (data.jobs || []).slice(0, 10).map((job) => {
      const extractedSkills = extractSkillsFromText(`${job.title} ${job.description} ${job.tags?.join(' ')}`);

      return {
        _id: `ext_remotive_${job.id}`,
        company: job.company_name,
        title: job.title,
        description: job.description ? job.description.substring(0, 300) : '',
        requiredSkills: extractedSkills.length > 0 ? extractedSkills : job.tags || ['Node.js'],
        location: job.candidate_required_location || 'Remote',
        workplaceType: 'remote',
        employmentType: job.job_type || 'full-time',
        salary: { min: 0, max: 0, currency: 'USD' },
        jobUrl: job.url,
        isExternal: true,
      };
    });
  } catch (error) {
    console.error('Remotive API Fetch Error:', error.message);
    return [];
  }
};