export interface DetectionOptions {
  excludeForks?: boolean;
  notify?: boolean;
  notificationUrl?: string;
  notificationMessage?: string;
  notificationType?: 'slack' | 'webhook' | 'email';
  apiToken?: string;
  searchPatterns?: string[];
  maxResults?: number;
  // 検索方法
  searchMethod?: 'blob-hash' | 'pattern' | 'hybrid'; // デフォルト: 'blob-hash'
  // Blob hash 検索設定
  maxBlobHashesToSearch?: number; // 検索するblobハッシュの最大数（デフォルト: 50）
  blobHashBatchSize?: number; // 1回の検索で使用するハッシュ数（デフォルト: 20）
  // マッチング閾値
  matchThresholdPercent?: number; // 何%のファイルが一致したら警告するか（デフォルト: 30）
  highMatchThresholdPercent?: number; // 高リスクとする閾値（デフォルト: 80）
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
  // Blob hash検索用の追加情報
  matchType?: 'blob-hash' | 'pattern' | 'commit';
  matchedFilesCount?: number; // 一致したファイル数
  totalFilesChecked?: number; // チェックしたファイル総数
  matchPercentage?: number; // 一致率（%）
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'; // リスクレベル
  matchedHashes?: string[]; // 一致したハッシュのリスト
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
