import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, EmailContext } from './types.js';

const SYSTEM_PROMPT = `あなたはプロフェッショナルなビジネスメール返信アシスタントです。
受信したメールに対して、適切な日本語ビジネスメールの返信本文を生成してください。

【ルール】
- 丁寧かつ簡潔な返信を書くこと
- 日本語ビジネスメールの慣習に従うこと（頭語・結語、時候の挨拶など必要に応じて）
- 返信本文のみを出力すること（件名・宛先・差出人・署名は含めない）
- 相手の要件や質問に的確に応答すること
- 判断が難しい内容は、受信の御礼と改めて確認・検討する旨を伝えること
- 文体は丁寧語（ですます調）で統一すること
- 出力は返信メール本文のテキストのみ。前置きや説明は不要`;

function buildUserPrompt(email: EmailContext): string {
  return `以下のメールに対する返信を生成してください。

【差出人】
${email.from}

【件名】
${email.subject}

【本文】
${email.body}`;
}

async function generateWithGroq(apiKey: string, email: EmailContext): Promise<string> {
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(email) },
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Groqからの返信生成に失敗しました');
  return text.trim();
}

async function generateWithGemini(apiKey: string, email: EmailContext): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent(buildUserPrompt(email));
  const text = result.response.text();
  if (!text) throw new Error('Geminiからの返信生成に失敗しました');
  return text.trim();
}

export interface GenerateReplyOptions {
  provider: AIProvider;
  groqApiKey?: string;
  geminiApiKey?: string;
}

export async function generateReply(
  email: EmailContext,
  opts: GenerateReplyOptions
): Promise<string> {
  if (opts.provider === 'gemini') {
    if (!opts.geminiApiKey) throw new Error('GEMINI_API_KEY が未設定です');
    return generateWithGemini(opts.geminiApiKey, email);
  } else {
    if (!opts.groqApiKey) throw new Error('GROQ_API_KEY が未設定です');
    return generateWithGroq(opts.groqApiKey, email);
  }
}

export function appendSignature(body: string, signature: string): string {
  if (!signature) return body;
  return `${body}\n\n${signature}`;
}
