# ◆ SignalForge

> **Developer Branding Infrastructure** — Transform engineering activity logs into authentic, trust-building content for LinkedIn, X, note, Qiita, and beyond.

SignalForge is not a social media scheduler. It's a **signal extraction pipeline**: it collects your daily engineering work, understands what you actually did, and converts it into platform-appropriate content that builds your professional reputation over time.

```
git commits + GitHub activity + work logs
         ↓
  [Collect] → normalized ActivityLogs
         ↓
  [Sanitize] → repo names abstracted, tokens removed
         ↓
  [Draft] → AI generates LinkedIn/X/note/Qiita variants
         ↓
  [Score] → AI evaluates branding value, virality, technical depth
         ↓
  [Publish] → Select best drafts → output/ directory
```

---

## Features

- **Plugin architecture** — add new source collectors (GitHub, Asana, Slack, Notion) or publishers (LinkedIn, X, Medium) without touching core logic
- **Multi-language output** — Japanese and English variants generated simultaneously
- **Intelligent sanitization** — URL removal, token scrubbing, repo name abstraction, custom pattern redaction
- **AI scoring** — each draft scored on LinkedIn fit, X fit, technical depth, virality, and brand formation power
- **Image search integration** — AI-generated search queries + Pexels/Unsplash API for post imagery
- **Beautiful CLI** — chalk + ora for a clean terminal experience
- **Zero-build dev** — runs directly via `tsx` with no compilation step

---

## Install

```bash
git clone https://github.com/yourname/signalforge
cd signalforge
npm install
```

Make the CLI executable:

```bash
chmod +x src/index.ts
```

Or run directly with tsx:

```bash
npx tsx src/index.ts --help
```

Add a shell alias for convenience:

```bash
# ~/.zshrc or ~/.bashrc
alias signalforge="npx tsx /path/to/signalforge/src/index.ts"
```

---

## Setup

### 1. Initialize

```bash
signalforge init
```

Creates:
- `signalforge.yml` — your configuration
- `.signalforge/` — internal cache (git-ignored)
- `drafts/` — generated draft files
- `output/` — publish-ready exports
- `.env.example` — API key template

### 2. Configure

Edit `signalforge.yml`:

```yaml
profile:
  name: Your Name
  role: Software Engineer

sources:
  localGit:
    repos:
      - /path/to/your/project
    daysBack: 7

targets:
  - linkedin
  - x
  - note
  - qiita

ai:
  provider: gemini  # or: groq
```

### 3. Set API Keys

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: choose one AI provider
GEMINI_API_KEY=your_key_here
# GROQ_API_KEY=your_key_here

# Optional: for image search
PEXELS_API_KEY=your_key_here
```

**Get API keys:**
- Gemini: https://aistudio.google.com/ (free tier available)
- Groq: https://console.groq.com/ (free tier, very fast)
- Pexels: https://www.pexels.com/api/ (free)

### 4. Authenticate Source Providers

```bash
signalforge auth github
signalforge auth asana
signalforge auth slack
```

Tokens are saved to your local `.env` file.

---

## Usage

### Collect Activity Logs

```bash
signalforge collect --config ./signalforge.yml
```

Collects from all configured sources and saves normalized logs to `.signalforge/logs_YYYY-MM-DD.json`.

### Generate Drafts

```bash
signalforge draft
```

Uses cached logs (or re-collects if none found). Generates `variants × targets × languages` drafts in `drafts/YYYY-MM-DD/`.

Override variant count:

```bash
signalforge draft --variants 2
```

Use specific logs file:

```bash
signalforge draft --logs .signalforge/logs_2026-06-14.json
```

### Review & Publish

```bash
signalforge publish
```

Interactive TUI to select your best drafts and export them to `output/YYYY-MM-DD/`.

Output structure:

```
output/
  2026-06-14/
    linkedin/
      jp/
        post_1_a3f2.md
        image_1.jpg
      en/
        post_1_b7c1.md
    x/
      jp/
        post_1_d9e4.md
```

---

## Output Format

Each draft is a Markdown file with YAML frontmatter:

```markdown
---
id: a3f2b1c0
date: 2026-06-14
target: linkedin
language: jp
variant: 1
overall_score: 87
---

# Post Content

[Your generated LinkedIn post here]

---

## Scores
| Metric | Score |
|--------|-------|
| LinkedIn | 92/100 |
| X (Twitter) | 68/100 |
| Technical | 85/100 |
| Virality | 74/100 |
| Branding | 91/100 |
| **Overall** | **87/100** |

## Source Activities
- localGit (2026-06-14): [my-project] 4 commits
```

---

## Architecture

```
signalforge/
 ┣ src/
 ┃ ┣ index.ts              # CLI entry point (Commander)
 ┃ ┣ commands/
 ┃ ┃ ┣ init.ts             # signalforge init
 ┃ ┃ ┣ auth.ts             # signalforge auth <provider>
 ┃ ┃ ┣ collect.ts          # signalforge collect
 ┃ ┃ ┣ draft.ts            # signalforge draft
 ┃ ┃ ┗ publish.ts          # signalforge publish
 ┃ ┣ collectors/
 ┃ ┃ ┣ index.ts            # Registry + plugin runner
 ┃ ┃ ┗ localGit.ts         # Git collector (simple-git)
 ┃ ┣ generators/
 ┃ ┃ ┗ index.ts            # AI draft generation pipeline
 ┃ ┣ providers/
 ┃ ┃ ┣ index.ts            # AI provider factory
 ┃ ┃ ┣ gemini.ts           # Google Gemini
 ┃ ┃ ┗ groq.ts             # Groq (Llama)
 ┃ ┣ prompts/
 ┃ ┃ ┗ index.ts            # Prompt templates per target/language
 ┃ ┣ scoring/
 ┃ ┃ ┗ index.ts            # AI scoring engine
 ┃ ┣ media/
 ┃ ┃ ┣ index.ts            # Media manager + download
 ┃ ┃ ┗ pexels.ts           # Pexels image provider
 ┃ ┣ utils/
 ┃ ┃ ┣ config.ts           # YAML loader + Zod validation
 ┃ ┃ ┣ sanitizer.ts        # Sensitive data scrubber
 ┃ ┃ ┣ logger.ts           # Chalk-based logger
 ┃ ┃ ┗ date.ts             # Date utilities
 ┃ ┗ types/
 ┃   ┗ index.ts            # All TypeScript types + interfaces
```

---

## Plugin Extension Guide

### Adding a New Source Collector

Create `src/collectors/yourSource.ts`:

```typescript
import type { Collector, ActivityLog, SignalForgeConfig } from "../types/index.js";

export const yourSourceCollector: Collector = {
  name: "yourSource",

  isAvailable(config: SignalForgeConfig): boolean {
    // Return true if this source is configured and credentials exist
    return !!config.sources.yourSource && !!process.env["YOUR_SOURCE_API_KEY"];
  },

  async collect(config: SignalForgeConfig): Promise<ActivityLog[]> {
    // Fetch data from your source and return normalized ActivityLog[]
    return [];
  },
};
```

Register in `src/collectors/index.ts`:

```typescript
import { yourSourceCollector } from "./yourSource.js";

const REGISTRY: Collector[] = [
  localGitCollector,
  yourSourceCollector, // ← add here
];
```

### Adding a New AI Provider

Implement the `AIProvider` interface:

```typescript
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";
  
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    // Call OpenRouter API
  }
}
```

Register in `src/providers/index.ts`.

### Adding a New Publish Target

1. Add the target to the `PublishTarget` union type in `src/types/index.ts`
2. Add platform guidelines to `TARGET_GUIDES` in `src/prompts/index.ts`
3. Implement a `Publisher` class if native API publishing is desired

---

## Roadmap

| Feature | Status |
|---------|--------|
| Local Git collector | ✅ MVP |
| Gemini AI provider | ✅ MVP |
| Groq AI provider | ✅ MVP |
| Pexels image search | ✅ MVP |
| AI scoring system | ✅ MVP |
| jp/en multi-language | ✅ MVP |
| GitHub Activity collector | 🔜 Next |
| Asana task collector | 🔜 Next |
| Slack message collector | 🔜 Next |
| LinkedIn native publish | 🔮 Future |
| X (Twitter) native publish | 🔮 Future |
| OpenRouter support | 🔮 Future |
| VSCode extension | 🔮 Future |

---

## Philosophy

> "Engineers who share build trust faster than those who stay silent."

SignalForge is built on the belief that **the gap between what engineers do and what others know they do** is a reputation problem — not a self-promotion problem.

The goal is never to exaggerate or fabricate. It's to extract the real signal from your daily work and express it in a form that creates genuine value for your audience.

**Build in public. Ship with intention. Let your work speak.**

---

## License

MIT
