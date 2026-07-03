import type { AIProvider, DraftScore, PublishTarget } from "../types/index.js";
import { buildScoringPrompt } from "../prompts/index.js";

// ─── Fallback Score ───────────────────────────────────────────────────────────

function fallbackScore(): DraftScore {
  return {
    linkedinScore: 70,
    xScore: 65,
    technicalScore: 75,
    viralityScore: 60,
    brandingScore: 72,
    overall: 68,
  };
}

// ─── Parse Score Response ─────────────────────────────────────────────────────

function parseScoreResponse(raw: string): DraftScore {
  // Strip possible markdown fences
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const score: DraftScore = {
    linkedinScore: Number(parsed["linkedinScore"] ?? 70),
    xScore: Number(parsed["xScore"] ?? 65),
    technicalScore: Number(parsed["technicalScore"] ?? 75),
    viralityScore: Number(parsed["viralityScore"] ?? 60),
    brandingScore: Number(parsed["brandingScore"] ?? 72),
    overall: Number(parsed["overall"] ?? 68),
  };

  // Clamp all values to 0-100
  for (const key of Object.keys(score) as (keyof DraftScore)[]) {
    score[key] = Math.min(100, Math.max(0, score[key]));
  }

  return score;
}

// ─── Scorer ───────────────────────────────────────────────────────────────────

export async function scoreDraft(
  content: string,
  target: PublishTarget,
  ai: AIProvider
): Promise<DraftScore> {
  try {
    const prompt = buildScoringPrompt(content, target);
    const raw = await ai.complete(prompt);
    return parseScoreResponse(raw);
  } catch {
    // Score failures should not break the workflow
    return fallbackScore();
  }
}
