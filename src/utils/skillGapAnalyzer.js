function normalizeKey(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Compares an explicit list of target skills against the candidate's known
 * skills (from their Career Profile), returning which ones they already
 * have and which are genuinely missing. Purely for transparency in the
 * response - the actual roadmap node generation doesn't depend on this list
 * being provided (see filterNodesAgainstKnownSkills below, which is the
 * safety net that applies regardless).
 */
export function computeSkillGap({ targetSkills, profileSkills }) {
  const profileKeys = new Set((profileSkills || []).map((s) => normalizeKey(s.name)));
  const alreadyHave = [];
  const missing = [];

  for (const raw of targetSkills || []) {
    const key = normalizeKey(raw);
    if (!key) continue;
    if (profileKeys.has(key)) {
      alreadyHave.push(raw.trim());
    } else {
      missing.push(raw.trim());
    }
  }

  return { alreadyHave, missing };
}

/**
 * Deterministically drops any AI-proposed roadmap node whose title matches
 * (case/whitespace-insensitively) a skill already confirmed in the
 * candidate's Career Profile. This is the actual enforcement mechanism for
 * "don't propose topics they already know" - applied regardless of whether
 * the caller supplied an explicit targetSkills list, since we can't fully
 * trust the AI to have followed that instruction on its own.
 */
export function filterNodesAgainstKnownSkills(nodes, profileSkills) {
  const profileKeys = new Set((profileSkills || []).map((s) => normalizeKey(s.name)));
  return nodes.filter((node) => !profileKeys.has(normalizeKey(node.title)));
}
