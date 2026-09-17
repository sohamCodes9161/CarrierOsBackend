import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Readable } from 'stream';

const mockSetMetadata = jest.fn().mockResolvedValue(undefined);
const mockToStream = jest.fn();
const mockClose = jest.fn();

jest.unstable_mockModule('msedge-tts', () => ({
  MsEdgeTTS: jest.fn().mockImplementation(() => ({
    setMetadata: mockSetMetadata,
    toStream: mockToStream,
    close: mockClose,
  })),
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3' },
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  env: { EDGE_TTS_VOICE: 'en-US-AriaNeural' },
}));

const { synthesizeSpeech } = await import('../src/integrations/edgeTts.integration.js');

/** Builds a real Readable stream that emits the given chunks then ends -
 * genuinely exercises the streamToBuffer logic rather than mocking it away. */
function fakeAudioStream(chunks) {
  return Readable.from(chunks.map((c) => Buffer.from(c)));
}

describe('synthesizeSpeech (edge-tts integration)', () => {
  beforeEach(() => {
    mockSetMetadata.mockClear();
    mockToStream.mockReset();
    mockClose.mockClear();
  });

  it('buffers the full audio stream correctly, in order', async () => {
    mockToStream.mockReturnValue({
      audioStream: fakeAudioStream(['hello ', 'world']),
      metadataStream: null,
    });

    const result = await synthesizeSpeech('Some question text.');
    expect(result).toEqual(Buffer.from('hello world'));
  });

  it('sets metadata with the configured voice and MP3 format before streaming', async () => {
    mockToStream.mockReturnValue({ audioStream: fakeAudioStream(['audio']), metadataStream: null });
    await synthesizeSpeech('Text.');
    expect(mockSetMetadata).toHaveBeenCalledWith('en-US-AriaNeural', 'audio-24khz-48kbitrate-mono-mp3');
  });

  it('synthesizes long, multi-sentence text in a single call - no chunking', async () => {
    const longText =
      'This is a fairly long interview question. '.repeat(10) + // ~450 chars, well over Orpheus's old 200-char limit
      'It should still be synthesized in exactly one call since Edge TTS has no such per-request limit.';
    mockToStream.mockReturnValue({ audioStream: fakeAudioStream(['audio-data']), metadataStream: null });

    await synthesizeSpeech(longText);
    expect(mockToStream).toHaveBeenCalledTimes(1);
    expect(mockToStream.mock.calls[0][0]).toBe(longText.trim());
  });

  it('always closes the connection after a successful synthesis', async () => {
    mockToStream.mockReturnValue({ audioStream: fakeAudioStream(['audio']), metadataStream: null });
    await synthesizeSpeech('Text.');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('always closes the connection even when synthesis throws', async () => {
    mockSetMetadata.mockRejectedValueOnce(new Error('connection failed'));
    await expect(synthesizeSpeech('Text.')).rejects.toThrow();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('throws a clean AppError when the stream errors mid-flight', async () => {
    const erroringStream = new Readable({
      read() {
        this.emit('error', new Error('stream broke'));
      },
    });
    mockToStream.mockReturnValue({ audioStream: erroringStream, metadataStream: null });

    await expect(synthesizeSpeech('Text.')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws a 400 AppError for empty/whitespace-only input without calling the service', async () => {
    await expect(synthesizeSpeech('   ')).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSetMetadata).not.toHaveBeenCalled();
  });

  it('throws a 502 AppError when the resulting audio buffer is empty', async () => {
    mockToStream.mockReturnValue({ audioStream: fakeAudioStream([]), metadataStream: null });
    await expect(synthesizeSpeech('Text.')).rejects.toMatchObject({ statusCode: 502 });
  });
});
