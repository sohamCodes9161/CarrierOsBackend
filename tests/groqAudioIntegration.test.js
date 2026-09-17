import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockTranscriptionsCreate = jest.fn();
const mockToFile = jest.fn().mockResolvedValue({ name: 'answer.webm' });

jest.unstable_mockModule('groq-sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: { create: mockTranscriptionsCreate },
    },
  })),
  toFile: mockToFile,
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  env: {
    GROQ_API_KEY: 'test-key',
    GROQ_STT_MODEL: 'whisper-large-v3-turbo',
  },
}));

const { transcribeAudio } = await import('../src/integrations/groqAudio.integration.js');

describe('transcribeAudio', () => {
  beforeEach(() => {
    mockTranscriptionsCreate.mockReset();
    mockToFile.mockClear();
  });

  it('returns the transcribed text on success', async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce({ text: '  Hello world  ' });
    const result = await transcribeAudio(Buffer.from('fake audio'), 'answer.webm', 'audio/webm');
    expect(result).toBe('Hello world'); // trimmed
  });

  it('throws a 400 AppError when transcription is empty', async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce({ text: '' });
    await expect(
      transcribeAudio(Buffer.from('silence'), 'answer.webm', 'audio/webm')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws a clean 429 AppError on rate limit', async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce({ status: 429 });
    await expect(
      transcribeAudio(Buffer.from('audio'), 'a.webm', 'audio/webm')
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws a clean 503 AppError on auth failure', async () => {
    mockTranscriptionsCreate.mockRejectedValueOnce({ status: 401 });
    await expect(
      transcribeAudio(Buffer.from('audio'), 'a.webm', 'audio/webm')
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it('passes the correct model to the SDK call', async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce({ text: 'ok' });
    await transcribeAudio(Buffer.from('audio'), 'a.webm', 'audio/webm');
    expect(mockTranscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'whisper-large-v3-turbo' })
    );
  });

  it('passes the file through toFile with the correct filename and mimetype', async () => {
    mockTranscriptionsCreate.mockResolvedValueOnce({ text: 'ok' });
    await transcribeAudio(Buffer.from('audio'), 'my-answer.mp3', 'audio/mpeg');
    expect(mockToFile).toHaveBeenCalledWith(expect.any(Buffer), 'my-answer.mp3', { type: 'audio/mpeg' });
  });
});
