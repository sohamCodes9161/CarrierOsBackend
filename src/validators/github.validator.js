import { z } from 'zod';

// GitHub username rules: alphanumeric + single hyphens, no leading/trailing hyphen, max 39 chars
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export const githubAnalyzeSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'GitHub username is required')
    .max(39, 'GitHub username is too long')
    .regex(GITHUB_USERNAME_REGEX, 'Invalid GitHub username format'),
});
