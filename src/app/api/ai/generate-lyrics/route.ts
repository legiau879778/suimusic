import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const { prompt, genre, language } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const systemPrompt = `You are a professional songwriter. Generate creative and original song lyrics based on the user's prompt. 
Make it poetic, rhythmic, and suitable for the specified genre and language.
Genre: ${genre || 'pop'}
Language: ${language || 'English'}
Keep it appropriate and copyright-free.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const lyrics = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({ lyrics });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json({ error: 'Failed to generate lyrics' }, { status: 500 });
  }
}