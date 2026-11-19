export const interviewQuestionSchemaName = 'interview_question';

export const interviewQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thoughtProcess: {
      type: 'string',
      description: 'Briefly explain your strategy for this question. Are you drilling down into the previous answer, or pivoting to a new topic from the target skills? Why?',
    },
    question: { type: 'string' },
    focusArea: {
      type: 'string',
      description: 'Short label for what this question targets, e.g. "Hash Maps & Two Pointers", "React fundamentals", "Conflict resolution"',
    },
  },
  required: ['thoughtProcess', 'question', 'focusArea'],
};

export function buildInterviewQuestionPrompt({
  role,
  difficulty,
  interviewType,
  targetSkills,
  remainingSkills,
  questionNumber,
  totalQuestions,
  history,
}) {
  const isFirstQuestion = history.length === 0;
  const isDsa = interviewType === 'dsa';

  const historyBlock = !isFirstQuestion
    ? history
        .map(
          (h, i) =>
            `Q${i + 1} (${h.focusArea}): ${h.questionText}\nCandidate's answer: ${h.answerText}\nEvaluation: correctness ${h.evaluation.correctnessScore}/100, weaknesses: ${h.evaluation.weaknesses.join(', ') || 'none noted'}`
        )
        .join('\n\n')
    : 'This is the first question - no prior history.';

  const difficultyGuidance = isDsa
    ? {
        easy: 'Focus on foundational data structures and standard patterns (arrays, strings, hash maps, two pointers, basic stacks/queues, simple recursion). Keep the problem concrete and approachable.',
        medium: 'Focus on classic algorithmic problem-solving and trade-offs (sliding window, binary search variations, BFS/DFS on trees and graphs, heaps, backtracking, or basic 1D/2D dynamic programming).',
        hard: 'Focus on optimal algorithmic design, tricky edge cases, and tight time/space bounds (advanced graph algorithms, multi-dimensional DP, monotonic stacks/queues, tries, or union-find).',
      }[difficulty]
    : {
        easy: 'Focus on foundational core concepts and basic syntax, asked conversationally—like explaining to a colleague rather than reciting a textbook definition.',
        medium: 'Focus on practical, scenario-based problem solving: real-world trade-offs and design decisions (e.g., handling scale, connection pooling, caching strategy, when to denormalize).',
        hard: 'Focus on edge cases, high-concurrency conflicts, internal engine mechanisms, system failure modes, and deep performance optimization under the hood.',
      }[difficulty];

  const interviewTypeNote = isDsa
    ? `\nSTRICT DSA DOMAIN RULE:
- This is strictly a Data Structures & Algorithms (DSA) interview.
- IGNORE web frameworks, databases, APIs, cloud infrastructure, and system design/architecture—even if the role title ("${role}") mentions a specific stack (like MERN, frontend, or backend).
- Every question MUST be an algorithmic or data-structure problem (arrays, strings, linked lists, trees, graphs, hash tables, heaps, stacks, queues, sorting, searching, recursion, dynamic programming, greedy algorithms, or Big-O analysis).
- Because this is voice-based, pose a clear problem and ask the candidate to verbally walk through their approach: which data structure(s) they would use, the step-by-step algorithm, and the time/space complexity. Never ask them to write or type code.`
    : '';

  const availableSkills = remainingSkills && remainingSkills.length > 0 ? remainingSkills : targetSkills;

  const behavioralGuidance = isFirstQuestion
    ? `Since this is the first question, pick ONE specific ${isDsa ? 'DSA topic/pattern' : 'concept'} from the target skills (${targetSkills.join(', ') || 'core fundamentals'}) to start the interview. Vary your starting point rather than always picking the most obvious topic.`
    : `Act like a real, conversational human interviewer. Analyze the candidate's last answer and evaluation:
1. DRILL DOWN (Follow-up): If they showed a gap, missed an edge case, or proposed a suboptimal approach, ask a targeted follow-up probing that exact point (e.g., "You mentioned using X—how would you handle...").
2. PIVOT (New Topic): If their last answer was solid or you've probed that topic enough, pivot to a new, unexplored topic from: ${availableSkills.join(', ')}.

Map out your 'thoughtProcess' first to explain why you chose to drill down or pivot.`;

  const absurdRoleHandling = isDsa
    ? ''
    : `\nROLE & DOMAIN HANDLING:
If the requested role ("${role}") or skills ("${targetSkills.join(', ')}") are framed around a specific tech library or framework (like React, Node, Python), treat it as a role specializing in that technology. If they are purely fictional or humorous (e.g., 'Professional Pizza Eater', 'Jedi'), play along with deadpan professionalism.`;

  return `You are conducting a ${interviewType} interview${isDsa ? ' (Data Structures & Algorithms focus)' : ` for a ${role} position`} at ${difficulty} difficulty.
Target topics to probe: ${targetSkills.length > 0 ? targetSkills.join(', ') : isDsa ? 'arrays, hash maps, trees, graphs, sorting, dynamic programming' : 'general role-relevant skills'}.

DIFFICULTY-SPECIFIC GUIDANCE FOR THIS QUESTION: ${difficultyGuidance}${interviewTypeNote}

This is question ${questionNumber} of ${totalQuestions}.

INTERVIEWER BEHAVIOR INSTRUCTIONS:
${behavioralGuidance}
${absurdRoleHandling}

PRIOR QUESTIONS AND ANSWERS IN THIS INTERVIEW:
${historyBlock}

LENGTH & SPOKEN CLARITY RULES (CRITICAL):
- Keep the question concise: **2 to 3 sentences maximum (under 55 words)**.
- Ask ONE focused question—do not stack multiple sub-questions or long backstories.
- Phrase it so it sounds natural when spoken aloud by a text-to-speech voice; avoid code blocks, brackets, or heavy symbols.
- Never repeat a question or concept already covered above.

Respond strictly following the response schema.`;
}