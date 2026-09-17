/**
 * Builds a short spoken greeting + intro for the start of a voice interview.
 * Deterministic template, not an AI call - keeps this fast, free, and
 * consistent, and avoids spending TTS budget on something that doesn't
 * need to vary.
 */
export function buildGreetingText({ role, difficulty, interviewType, targetSkills }) {
  const skillsPhrase = targetSkills.length > 0 ? `, focusing on ${targetSkills.join(', ')}` : '';
  return `Hi there! I'm your AI interviewer today. We'll be doing a ${difficulty} ${interviewType} interview for the ${role} role${skillsPhrase}. I'll ask you a few questions, and you can answer out loud whenever you're ready. Let's get started.`;
}
