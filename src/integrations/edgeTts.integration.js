import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/**
 * Buffers a Readable stream into a single Buffer. Standard Node stream
 * consumption - no manual byte-offset math, no format-specific header
 * parsing needed here (unlike the WAV chunk-stitching this replaces),
 * since msedge-tts synthesizes the full input natively as one MP3 stream.
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Synthesizes speech for text of any length (a full interview question, a
 * multi-sentence final report summary) in one native call - no 200-char
 * chunking or manual audio-buffer stitching required, since Edge Neural TTS
 * has no such per-request length limit for reasonable interview-length text.
 *
 * A fresh MsEdgeTTS instance (and its WebSocket connection) is created per
 * call and always closed in `finally`, so a failed or successful synthesis
 * never leaks an open connection.
 */
export async function synthesizeSpeech(text) {
  const cleaned = text?.trim();
  if (!cleaned) {
    throw new AppError('No text provided to synthesize', 400);
  }

  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(env.EDGE_TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleaned);
    const audioBuffer = await streamToBuffer(audioStream);

    if (audioBuffer.length === 0) {
      throw new AppError('AI voice service returned empty audio', 502);
    }

    return audioBuffer;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('AI voice synthesis failed. The Edge TTS service may be temporarily unreachable.', 502);
  } finally {
    tts.close(); // always release the WebSocket connection, success or failure
  }
}
