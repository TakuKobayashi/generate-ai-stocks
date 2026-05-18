export interface DetectionOptions {
  excludeForks?: boolean;
  notify?: boolean;
  notificationUrl?: string;
  notificationMessage?: string;
  notificationType?: 'slack' | 'webhook' | 'email';
  apiToken?: string;
  searchPatterns?: string[];
  maxResults?: number;
}

export interface LeakResult {
  repositoryUrl: string;
  repositoryName: string;
  ownerName: string;
  ownerEmail?: string;
  ownerGithubUrl: string;
  createdAt: string;
  isFork: boolean;
  matchedPattern: string;
  matchedFile?: string;
}

export interface GitRemoteInfo {
  url: string;
  owner: string;
  repo: string;
}

export interface SearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: SearchResultItem[];
}

export interface SearchResultItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  repository: Repository;
  score: number;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: Owner;
  html_url: string;
  description: string;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  language: string;
}

export interface Owner {
  login: string;
  id: number;
  avatar_url: string;
  url: string;
  html_url: string;
  type: string;
}

export interface NotificationPayload {
  leaks: LeakResult[];
  totalLeaks: number;
  repository: string;
  detectedAt: string;
}
