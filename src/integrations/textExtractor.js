import mammoth from 'mammoth';
import { BadRequestError } from '../errors/AppError.js';

/**
 * Extracts raw text from a resume file buffer based on its mimetype.
 * Kept deterministic and dependency-isolated so the AI layer never
 * has to deal with binary formats directly.
 */
export async function extractTextFromBuffer(buffer, mimetype) {
  let text = '';

  if (mimetype === 'application/pdf') {
    // pdf-parse v2 uses a class-based API: new PDFParse({ data }).getText()
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text;
  } else if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    throw new BadRequestError('Unsupported file type for text extraction');
  }

  const cleaned = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, ' ') // strip pdf-parse page markers e.g. "-- 1 of 1 --"
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 50) {
    throw new BadRequestError(
      'Could not extract readable text from this file. It may be a scanned image or corrupted.'
    );
  }

  return cleaned;
}
