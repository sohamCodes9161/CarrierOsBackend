const MAX_CHUNK_LENGTH = 190; // stay safely under Orpheus's 200-char hard limit

/**
 * Splits text into chunks safe for Orpheus TTS (200-char limit per request),
 * preferring to break on sentence boundaries so each chunk still sounds
 * natural when spoken. Falls back to word-boundary splitting for any single
 * sentence that's itself over the limit.
 */
export function chunkTextForTTS(text, maxLength = MAX_CHUNK_LENGTH) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [cleaned];

  const chunks = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if (sentence.length > maxLength) {
      // A single sentence is itself too long - flush current, then hard-split by words
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      chunks.push(...splitByWords(sentence, maxLength));
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      chunks.push(current.trim());
      current = sentence;
    }
  }

  if (current) chunks.push(current.trim());

  return chunks;
}

function splitByWords(sentence, maxLength) {
  const words = sentence.split(' ');
  const chunks = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current.trim());
      current = word;
    }
  }
  if (current) chunks.push(current.trim());

  return chunks;
}
