import { describe, it, expect } from '@jest/globals';
import { concatWavBuffers } from '../src/utils/wavConcat.js';

/** Builds a real, valid canonical 44-byte-header PCM WAV buffer containing
 * `numSamples` samples of silence (or a simple ramp), matching exactly the
 * format Groq's Orpheus TTS returns. */
function buildTestWav({ numSamples = 100, sampleRate = 24000, numChannels = 1, bitsPerSample = 16 }) {
  const bytesPerSample = bitsPerSample / 8;
  const dataLength = numSamples * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataLength);

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataLength, 40);

  // fill with a simple recognizable ramp so we can verify data ordering after concat
  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(i % 32767, 44 + i * 2);
  }

  return buffer;
}

function parseHeaderFields(buffer) {
  return {
    riff: buffer.toString('ascii', 0, 4),
    wave: buffer.toString('ascii', 8, 12),
    numChannels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    bitsPerSample: buffer.readUInt16LE(34),
    dataSize: buffer.readUInt32LE(40),
    riffChunkSize: buffer.readUInt32LE(4),
  };
}

describe('concatWavBuffers', () => {
  it('returns the single buffer unchanged when only one is given', () => {
    const wav = buildTestWav({ numSamples: 50 });
    expect(concatWavBuffers([wav])).toEqual(wav);
  });

  it('produces a valid WAV header for the concatenated result', () => {
    const wav1 = buildTestWav({ numSamples: 50 });
    const wav2 = buildTestWav({ numSamples: 30 });
    const result = concatWavBuffers([wav1, wav2]);
    const header = parseHeaderFields(result);

    expect(header.riff).toBe('RIFF');
    expect(header.wave).toBe('WAVE');
    expect(header.numChannels).toBe(1);
    expect(header.sampleRate).toBe(24000);
    expect(header.bitsPerSample).toBe(16);
  });

  it('correctly sums the data size of all input buffers', () => {
    const wav1 = buildTestWav({ numSamples: 50 }); // 100 bytes of data
    const wav2 = buildTestWav({ numSamples: 30 }); // 60 bytes of data
    const wav3 = buildTestWav({ numSamples: 20 }); // 40 bytes of data
    const result = concatWavBuffers([wav1, wav2, wav3]);
    const header = parseHeaderFields(result);

    expect(header.dataSize).toBe(100 + 60 + 40);
    expect(result.length).toBe(44 + 200); // header + combined data
  });

  it('sets riffChunkSize consistent with the total file size (36 + dataSize)', () => {
    const wav1 = buildTestWav({ numSamples: 50 });
    const wav2 = buildTestWav({ numSamples: 50 });
    const result = concatWavBuffers([wav1, wav2]);
    const header = parseHeaderFields(result);
    expect(header.riffChunkSize).toBe(36 + header.dataSize);
  });

  it('preserves sample data in order (first buffer data, then second)', () => {
    const wav1 = buildTestWav({ numSamples: 3 }); // samples 0,1,2
    const wav2 = buildTestWav({ numSamples: 3 }); // samples 0,1,2 again
    const result = concatWavBuffers([wav1, wav2]);

    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(result.readInt16LE(44 + i * 2));
    }
    expect(samples).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('throws when concatenating WAV buffers with mismatched sample rates', () => {
    const wav1 = buildTestWav({ numSamples: 10, sampleRate: 24000 });
    const wav2 = buildTestWav({ numSamples: 10, sampleRate: 44100 });
    expect(() => concatWavBuffers([wav1, wav2])).toThrow('mismatched audio formats');
  });

  it('throws when concatenating WAV buffers with mismatched channel counts', () => {
    const wav1 = buildTestWav({ numSamples: 10, numChannels: 1 });
    const wav2 = buildTestWav({ numSamples: 10, numChannels: 2 });
    expect(() => concatWavBuffers([wav1, wav2])).toThrow('mismatched audio formats');
  });

  it('throws on an empty array', () => {
    expect(() => concatWavBuffers([])).toThrow('No WAV buffers');
  });

  it('throws on a non-WAV buffer', () => {
    expect(() => concatWavBuffers([Buffer.from('not a wav file at all')])).toThrow('Not a valid WAV buffer');
  });
});