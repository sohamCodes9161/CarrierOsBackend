import { describe, it, expect } from '@jest/globals';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { extractTextFromBuffer } from '../src/integrations/textExtractor.js';

const SAMPLE_TEXT =
  'Jane Doe Software Engineer with five years of experience building scalable backend systems using Node.js Express and MongoDB. Led a team of four engineers to deliver a payments platform handling ten thousand transactions per day.';

async function makeSamplePdfBuffer() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(SAMPLE_TEXT, { x: 50, y: 750, size: 12, font, maxWidth: 500, lineHeight: 16 });
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

async function makeSampleDocxBuffer() {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(SAMPLE_TEXT)] })] }],
  });
  return Packer.toBuffer(doc);
}

describe('extractTextFromBuffer', () => {
  it('extracts readable text from a real PDF buffer', async () => {
    const buffer = await makeSamplePdfBuffer();
    const text = await extractTextFromBuffer(buffer, 'application/pdf');
    expect(text.toLowerCase()).toContain('software engineer');
    expect(text.toLowerCase()).toContain('mongodb');
  });

  it('extracts readable text from a real DOCX buffer', async () => {
    const buffer = await makeSampleDocxBuffer();
    const text = await extractTextFromBuffer(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(text.toLowerCase()).toContain('software engineer');
    expect(text.toLowerCase()).toContain('node.js');
  });

  it('rejects an unsupported mimetype', async () => {
    await expect(extractTextFromBuffer(Buffer.from('hello'), 'image/png')).rejects.toThrow(
      'Unsupported file type'
    );
  });

  it('rejects a file with too little extractable text (e.g. blank/scanned)', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([600, 800]); // blank page, no text
    const bytes = await pdfDoc.save();
    await expect(extractTextFromBuffer(Buffer.from(bytes), 'application/pdf')).rejects.toThrow(
      'Could not extract readable text'
    );
  });
});
