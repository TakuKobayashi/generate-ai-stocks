import type { ActivityLog, Language, PublishTarget } from "../types/index.js";

// ─── Target Constraints ───────────────────────────────────────────────────────

const TARGET_GUIDES: Record<PublishTarget, string> = {
  linkedin: `
- Professional tone, thought leadership angle
- 150-300 words
- Start with a hook sentence that grabs attention
- Include 1-3 key learnings or insights
- End with a question or call-to-action to drive engagement
- 3-5 relevant hashtags at the end
- Emphasize product thinking, engineering depth, or team learnings
`.trim(),

  x: `
- Maximum 280 characters (hard limit!)
- Punchy, conversational, opinionated
- One core idea only
- Optional: 1-2 hashtags max
- Can include a thread-starter hook if the idea needs expansion
`.trim(),

  note: `
- Japanese blog platform, think-piece style
- 500-800 characters (Japanese)
- Use markdown headers
- Personal reflection + technical insight combo
- Engaging title that makes people want to read
`.trim(),

  qiita: `
- Technical article for engineers
- 800-1500 characters (Japanese)
- Focus on the technical learnings, implementation details
- Include code snippets if relevant (use markdown code blocks)
- Practical, actionable content
- Use appropriate technical tags
`.trim(),

  reddit: `
- Community-first, humble tone
- No self-promotion feel
- Share learnings/experience genuinely
- 100-250 words
- End with a question to the community
`.trim(),

  devto: `
- Developer community blog
- 400-700 words in English
- Use markdown headers and code blocks
- Practical tutorial or experience-sharing angle
- Personal but professional tone
`.trim(),

  medium: `
- General tech/engineering audience
- 500-800 words in English
- Storytelling approach: problem → process → insight
- Broad appeal beyond just engineers
`.trim(),
};

// ─── Language Instructions ────────────────────────────────────────────────────

const LANG_INSTRUCTIONS: Record<Language, string> = {
  jp: "日本語で書いてください。自然で読みやすい日本語を使用してください。",
  en: "Write in clear, natural English. Avoid overly formal or corporate language.",
};

// ─── System Prompt ────────────────────────────────────────────────────────────

export function buildSystemPrompt(profile: {
  name: string;
  role: string;
  bio?: string;
}): string {
  return `You are a developer branding assistant helping ${profile.name}, a ${profile.role}${profile.bio ? ` who ${profile.bio}` : ""}.

Your mission is to transform engineering activity logs into authentic, value-driven content that builds trust and reputation over time.

Core principles:
- Build in public: share real learnings, not just wins
- Product thinking: connect technical work to user/business impact
- Authentic voice: avoid corporate speak and buzzword overload
- Specific over generic: concrete details beat vague claims
- Insight over activity: "I learned X because Y" beats "I worked on Z"

Never:
- Invent specific numbers or metrics not present in the logs
- Include company names, client names, or internal project codenames
- Include URLs, tokens, or any sensitive identifiers
- Sound like a press release`;
}

// ─── Draft Prompt ─────────────────────────────────────────────────────────────

export function buildDraftPrompt(
  logs: ActivityLog[],
  target: PublishTarget,
  language: Language,
  variantIndex: number
): string {
  const logSummary = logs
    .map(
      (l, i) =>
        `[Activity ${i + 1}] ${l.title}\nSummary: ${l.summary}\nTags: ${l.tags.join(", ")}`
    )
    .join("\n\n");

  const langInstruction = LANG_INSTRUCTIONS[language];
  const targetGuide = TARGET_GUIDES[target];

  const variationHint =
    variantIndex === 0
      ? "Focus on the main technical insight or achievement."
      : variantIndex === 1
      ? "Focus on the learning journey — what was challenging, what you discovered."
      : "Focus on the broader product or team impact, zooming out from the technical detail.";

  return `
${langInstruction}

Here are today's engineering activities:

${logSummary}

---

Platform: ${target.toUpperCase()}
Platform guidelines:
${targetGuide}

Variation angle: ${variationHint}

Write a single post draft for ${target.toUpperCase()}. Output only the post content — no meta-commentary, no "Here is the post:" preamble, no surrounding quotes.
`.trim();
}

// ─── Scoring Prompt ───────────────────────────────────────────────────────────

export function buildScoringPrompt(
  content: string,
  target: PublishTarget
): string {
  return `
Evaluate this ${target.toUpperCase()} post draft for developer branding effectiveness.

Post:
"""
${content}
"""

Score each dimension 0-100 and respond ONLY with valid JSON, no explanation:

{
  "linkedinScore": <0-100>,
  "xScore": <0-100>,
  "technicalScore": <0-100>,
  "viralityScore": <0-100>,
  "brandingScore": <0-100>,
  "overall": <0-100>
}

Scoring criteria:
- linkedinScore: professional insight value, engagement potential for engineering audience
- xScore: shareability, punchy clarity, conversation-starting potential  
- technicalScore: depth and accuracy of technical content
- viralityScore: potential to be shared beyond existing followers
- brandingScore: how well it builds sustained trust/reputation vs one-off attention
- overall: weighted average, emphasizing brandingScore and technicalScore
`.trim();
}

// ─── Image Search Query Prompt ────────────────────────────────────────────────

export function buildImageQueryPrompt(
  logs: ActivityLog[],
  target: PublishTarget
): string {
  const topics = logs.flatMap((l) => l.tags).join(", ");
  return `
Given these engineering activity topics: ${topics}

Generate a single, concise image search query (3-6 words) for a professional stock photo 
that would visually complement a ${target} post about this work.

The image should be abstract and professional — avoid literal code screenshots.
Think: developer workflow, technology, collaboration, problem-solving, building.

Respond with ONLY the search query, nothing else.
`.trim();
}
