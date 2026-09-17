import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCreate = jest.fn();

jest.unstable_mockModule('groq-sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

jest.unstable_mockModule('../src/config/env.js', () => ({
  env: { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-120b' },
}));

const { generateStructuredContent } = await import('../src/integrations/groq.integration.js');

const testSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { foo: { type: 'string' }, bar: { type: 'integer' } },
  required: ['foo', 'bar'],
};

function mockResponse(contentObj) {
  return { choices: [{ message: { content: JSON.stringify(contentObj) } }] };
}

describe('generateStructuredContent (Groq integration)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns parsed JSON on a successful strict-mode call', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse({ foo: 'hello', bar: 42 }));

    const result = await generateStructuredContent({
      prompt: 'test prompt',
      responseSchema: testSchema,
      schemaName: 'test_schema',
    });

    expect(result).toEqual({ foo: 'hello', bar: 42 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].response_format.type).toBe('json_schema');
  });

  it('falls back to JSON object mode when strict schema mode fails with a non-definite error', async () => {
    mockCreate.mockRejectedValueOnce({ status: 400, message: 'response_format not supported' });
    mockCreate.mockResolvedValueOnce(mockResponse({ foo: 'fallback', bar: 7 }));

    const result = await generateStructuredContent({
      prompt: 'test prompt',
      responseSchema: testSchema,
      schemaName: 'test_schema',
    });

    expect(result).toEqual({ foo: 'fallback', bar: 7 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].response_format.type).toBe('json_object');
  });

  it('throws a clean 429 AppError on rate limit, without attempting a fallback', async () => {
    mockCreate.mockRejectedValueOnce({ status: 429, message: 'rate limited' });

    await expect(
      generateStructuredContent({ prompt: 'p', responseSchema: testSchema, schemaName: 'test_schema' })
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(mockCreate).toHaveBeenCalledTimes(1); // no fallback attempt on a definite rate-limit error
  });

  it('throws a clean 503 AppError on auth failure, without attempting a fallback', async () => {
    mockCreate.mockRejectedValueOnce({ status: 401, message: 'invalid key' });

    await expect(
      generateStructuredContent({ prompt: 'p', responseSchema: testSchema, schemaName: 'test_schema' })
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('throws a 502 AppError when the response has missing required fields (even after fallback)', async () => {
    mockCreate.mockRejectedValueOnce({ status: 400, message: 'unsupported' });
    mockCreate.mockResolvedValueOnce(mockResponse({ foo: 'only foo, missing bar' }));

    await expect(
      generateStructuredContent({ prompt: 'p', responseSchema: testSchema, schemaName: 'test_schema' })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws a 502 AppError when the response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'not json at all' } }] });

    await expect(
      generateStructuredContent({ prompt: 'p', responseSchema: testSchema, schemaName: 'test_schema' })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('throws a 502 AppError when the response content is empty', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '' } }] });

    await expect(
      generateStructuredContent({ prompt: 'p', responseSchema: testSchema, schemaName: 'test_schema' })
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
