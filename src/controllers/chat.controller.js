import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export const handleChat = asyncHandler(async (req, res) => {
  const { messages, context } = req.body;
  const user = req.user; // We will attach user name from DB in middleware later if needed, or get it from frontend.

  // The System Prompt gives the AI its personality and rules
  const systemPrompt = {
    role: 'system',
    content: `You are the "CareerOS AI Mentor", a highly skilled, supportive Senior Software Engineer. 
    The user's name is ${context?.userName || 'Student'}. They are currently on the "${context?.page || 'Dashboard'}" page of CareerOS.
    
    YOUR CAPABILITIES:
    1. Answer technical/coding questions, explain DSA concepts, and debug code snippets.
    2. Suggest improvements for resumes, portfolios, and interview answers.
    3. Help them navigate CareerOS based on the page they are currently on.
    
    YOUR RESTRICTIONS:
    1. DO NOT write full applications, entire websites, or massive scripts. Keep code examples small, educational, and focused.
    2. If asked to do heavy development, politely decline and offer to explain the concepts instead.
    3. Keep responses concise (under 250 words) and format code nicely using Markdown.
    4. You ONLY talk about software engineering, careers, and the CareerOS platform. Refuse off-topic prompts.`
  };

  // Combine the system prompt with the user's chat history
  const chatHistory = [systemPrompt, ...messages];

  // Call Groq (Using Llama 3 8B because it is blazing fast and uses very few tokens)
  const completion = await groq.chat.completions.create({
    messages: chatHistory,
    model: 'llama-3.1-8b-instant',
    temperature: 0.5,
    max_tokens: 500, // Hard limit to protect your quota
  });

  const reply = completion.choices[0].message;

  sendSuccess(res, { data: { reply } });
});