export interface Env {
  KV: KVNamespace;
  ASSETS: Fetcher;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  OPENAI_API_KEY: string;
}

// KV Keys
export const KV_KEYS = {
  README_TABLE: "readme:table",
  README_LAST_FETCHED: "readme:last_fetched",
  AUTH_USER: "auth:user",
  PASSKEY_CHALLENGE: "auth:challenge",
  PASSKEY_CREDENTIALS: "auth:credentials",
} as const;
