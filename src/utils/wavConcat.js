/**
 * Safely parses a RIFF WAV buffer by searching dynamically for the 'data' chunk
 * instead of assuming a fixed 44-byte header layout.
 */
function parseWav(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a valid WAV buffer');
  }

  let offset = 12;
  let numChannels, sampleRate, bitsPerSample, data;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      numChannels = buffer.readUInt16LE(offset + 8 + 2);
      sampleRate = buffer.readUInt32LE(offset + 8 + 4);
      bitsPerSample = buffer.readUInt16LE(offset + 8 + 14);
    } else if (chunkId === 'data') {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, buffer.length);
      data = buffer.subarray(start, end);
      break;
    }

    // Move to next chunk (padded to even byte boundary)
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!numChannels || !sampleRate || !bitsPerSample || !data) {
    throw new Error('Invalid WAV structure: Missing fmt or data chunks');
  }

  return { numChannels, sampleRate, bitsPerSample, data };
}

function buildWavHeader({ numChannels, sampleRate, bitsPerSample, dataLength }) {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // Standard PCM fmt size
  header.writeUInt16LE(1, 20);   // PCM Format = 1
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);

  return header;
}

/**
 * Concatenates multiple WAV buffers into a single valid audio stream.
 */
export function concatWavBuffers(buffers) {
  if (!buffers || buffers.length === 0) {
    throw new Error('No WAV buffers to concatenate');
  }

  const parsed = buffers.map(parseWav);

  const { numChannels, sampleRate, bitsPerSample } = parsed[0];

  for (const p of parsed.slice(1)) {
    if (p.numChannels !== numChannels || p.sampleRate !== sampleRate || p.bitsPerSample !== bitsPerSample) {
      throw new Error('Cannot concatenate WAV buffers with mismatched audio formats');
    }
  }

  const combinedData = Buffer.concat(parsed.map((p) => p.data));
  const header = buildWavHeader({ numChannels, sampleRate, bitsPerSample, dataLength: combinedData.length });

  return Buffer.concat([header, combinedData]);
}