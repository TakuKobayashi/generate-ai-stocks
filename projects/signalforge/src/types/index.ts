// ─── Activity Log ────────────────────────────────────────────────────────────

export type ActivityLog = {
  source: string;
  timestamp: string;
  title: string;
  summary: string;
  tags: string[];
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
};

// ─── Config ──────────────────────────────────────────────────────────────────

export type Language = "jp" | "en";

export type PublishTarget =
  | "linkedin"
  | "x"
  | "note"
  | "qiita"
  | "reddit"
  | "devto"
  | "medium";

export type MediaMode = "search" | "generate" | "none";

export type LocalGitSource = {
  repos: string[];
  branchFilter?: string;
  daysBack?: number;
};

export type GitHubSource = {
  username: string;
  daysBack?: number;
};

export type SourceConfig = {
  localGit?: LocalGitSource;
  github?: GitHubSource;
  asana?: { projectId?: string; daysBack?: number };
  slack?: { channels?: string[]; daysBack?: number };
};

export type SignalForgeConfig = {
  profile: {
    name: string;
    role: string;
    bio?: string;
  };
  sources: SourceConfig;
  publish: {
    languages: Language[];
  };
  targets: PublishTarget[];
  media: {
    enabled: boolean;
    mode: MediaMode;
    pexelsApiKey?: string;
    unsplashAccessKey?: string;
    pixabayApiKey?: string;
  };
  draft: {
    variants: number;
  };
  ai: {
    provider: "groq" | "gemini" | "openrouter";
    model?: string;
  };
  sanitize: {
    enabled: boolean;
    patterns?: string[];
  };
};

// ─── Draft ───────────────────────────────────────────────────────────────────

export type DraftScore = {
  linkedinScore: number;
  xScore: number;
  technicalScore: number;
  viralityScore: number;
  brandingScore: number;
  overall: number;
};

export type MediaAsset = {
  url: string;
  localPath?: string;
  query: string;
  attribution?: string;
};

export type Draft = {
  id: string;
  date: string;
  variantIndex: number;
  language: Language;
  target: PublishTarget;
  title: string;
  body: string;
  tags: string[];
  score: DraftScore;
  media?: MediaAsset;
  sourceActivities: ActivityLog[];
  createdAt: string;
};

// ─── Collector Plugin Interface ───────────────────────────────────────────────

export interface Collector {
  readonly name: string;
  isAvailable(config: SignalForgeConfig): boolean;
  collect(config: SignalForgeConfig): Promise<ActivityLog[]>;
}

// ─── Publisher Plugin Interface ───────────────────────────────────────────────

export interface Publisher {
  readonly name: string;
  readonly target: PublishTarget;
  isAvailable(config: SignalForgeConfig): boolean;
  publish(draft: Draft, config: SignalForgeConfig): Promise<{ url?: string }>;
}

// ─── AI Provider Interface ────────────────────────────────────────────────────

export interface AIProvider {
  readonly name: string;
  complete(prompt: string, systemPrompt?: string): Promise<string>;
}

// ─── Media Provider Interface ─────────────────────────────────────────────────

export interface MediaProvider {
  readonly name: string;
  search(query: string, count?: number): Promise<MediaAsset[]>;
}
