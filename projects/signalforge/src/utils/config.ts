import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { z } from "zod";
import type { SignalForgeConfig } from "../types/index.js";

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const LanguageSchema = z.enum(["jp", "en"]);
const PublishTargetSchema = z.enum([
  "linkedin",
  "x",
  "note",
  "qiita",
  "reddit",
  "devto",
  "medium",
]);

const ConfigSchema = z.object({
  profile: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    bio: z.string().optional(),
  }),
  sources: z.object({
    localGit: z
      .object({
        repos: z.array(z.string()),
        branchFilter: z.string().optional(),
        daysBack: z.number().int().positive().optional().default(7),
      })
      .optional(),
    github: z
      .object({
        username: z.string(),
        daysBack: z.number().int().positive().optional().default(7),
      })
      .optional(),
    asana: z
      .object({
        projectId: z.string().optional(),
        daysBack: z.number().int().positive().optional().default(7),
      })
      .optional(),
    slack: z
      .object({
        channels: z.array(z.string()).optional(),
        daysBack: z.number().int().positive().optional().default(7),
      })
      .optional(),
  }),
  publish: z.object({
    languages: z.array(LanguageSchema).min(1).default(["jp"]),
  }),
  targets: z.array(PublishTargetSchema).min(1),
  media: z
    .object({
      enabled: z.boolean().default(false),
      mode: z.enum(["search", "generate", "none"]).default("none"),
      pexelsApiKey: z.string().optional(),
      unsplashAccessKey: z.string().optional(),
      pixabayApiKey: z.string().optional(),
    })
    .default({ enabled: false, mode: "none" }),
  draft: z
    .object({
      variants: z.number().int().min(1).max(5).default(3),
    })
    .default({ variants: 3 }),
  ai: z
    .object({
      provider: z.enum(["groq", "gemini", "openrouter"]).default("gemini"),
      model: z.string().optional(),
    })
    .default({ provider: "gemini" }),
  sanitize: z
    .object({
      enabled: z.boolean().default(true),
      patterns: z.array(z.string()).optional(),
    })
    .default({ enabled: true }),
});

// ─── Loader ──────────────────────────────────────────────────────────────────

export function loadConfig(configPath: string): SignalForgeConfig {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config file not found: ${resolved}\nRun \`signalforge init\` to create one.`
    );
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = yaml.load(raw);

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${issues}`);
  }

  return result.data as SignalForgeConfig;
}

// ─── Default Config Template ──────────────────────────────────────────────────

export const DEFAULT_CONFIG_YAML = `# SignalForge Configuration
# Developer Branding Infrastructure

profile:
  name: Your Name
  role: Software Engineer
  bio: Building in public, one commit at a time.

sources:
  localGit:
    repos:
      - /path/to/your/repo
    daysBack: 7

publish:
  languages:
    - jp
    - en

targets:
  - linkedin
  - x
  - note
  - qiita

media:
  enabled: true
  mode: search
  # pexelsApiKey: your_pexels_key
  # unsplashAccessKey: your_unsplash_key

draft:
  variants: 3

ai:
  provider: gemini  # groq | gemini | openrouter
  # model: gemini-1.5-flash

sanitize:
  enabled: true
`;
