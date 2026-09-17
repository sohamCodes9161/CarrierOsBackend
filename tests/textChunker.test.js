import { describe, it, expect } from '@jest/globals';
import { chunkTextForTTS } from '../src/utils/textChunker.js';

describe('chunkTextForTTS', () => {
  it('returns a single chunk for short text', () => {
    const chunks = chunkTextForTTS('Hello, how are you today?');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Hello, how are you today?');
  });

  it('returns an empty array for empty/whitespace-only input', () => {
    expect(chunkTextForTTS('')).toEqual([]);
    expect(chunkTextForTTS('   ')).toEqual([]);
  });

  it('keeps every chunk within the max length', () => {
    const longText =
      'This is a fairly long sentence that describes something in detail. ' +
      'Here is another sentence with more explanation and context. ' +
      'And a third sentence to push us well past the two hundred character limit for a single request. ' +
      'Finally a fourth sentence to be thorough about testing this chunking logic properly.';
    const chunks = chunkTextForTTS(longText, 190);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(190);
    }
  });

  it('reconstructs (roughly) the same content when chunks are rejoined', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.';
    const chunks = chunkTextForTTS(text, 190);
    expect(chunks.join(' ')).toContain('First sentence');
    expect(chunks.join(' ')).toContain('Third sentence');
  });

  it('hard-splits a single sentence that alone exceeds the max length', () => {
    const oneHugeSentence = 'word '.repeat(80).trim() + '.'; // ~400 chars, no internal punctuation breaks
    const chunks = chunkTextForTTS(oneHugeSentence, 190);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(190);
    }
  });

  it('does not produce any empty chunks', () => {
    const chunks = chunkTextForTTS('One. Two. Three. Four. Five.', 10);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it('packs multiple short sentences into one chunk when they fit', () => {
    const chunks = chunkTextForTTS('Hi. Yes. Sure. Okay.', 190);
    expect(chunks).toHaveLength(1);
  });
});
