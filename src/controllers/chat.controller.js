import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export const handleChat = asyncHandler(async (req, res) => {
  const { messages, context } = req.body;

  const systemPrompt = {
    role: 'system',
    content: `You are the "CareerOS AI Mentor", a highly skilled, supportive Senior Software Engineer. 
    The user's name is ${context?.userName || 'Student'}. They are currently on the "${context?.page || 'Dashboard'}" page of CareerOS.
    
    YOUR CAPABILITIES:
    1. Answer technical/coding questions, explain DSA concepts, debug code snippets, and suggest improvements.
    2. Help them navigate CareerOS based on the page they are currently on.
    
    YOUR RESTRICTIONS:
    1. DO NOT write full applications, entire websites, or massive scripts. Keep code examples small, educational, and focused.
    2. If asked to do heavy development, politely decline and offer to explain the concepts instead.
    3. Keep responses concise (under 250 words) and format code nicely using Markdown.
    4. You ONLY talk about software engineering, careers, and the CareerOS platform. Refuse off-topic prompts.`
  };

  const chatHistory = [systemPrompt, ...messages];

  // Uses your exact .env configuration variable name: GROQ_MODEL
  const completion = await groq.chat.completions.create({
    messages: chatHistory,
    model: env.GROQ_MODEL,
    temperature: 0.5,
    max_tokens: 500,
  });

  const reply = completion.choices[0].message;

  sendSuccess(res, { data: { reply } });
});