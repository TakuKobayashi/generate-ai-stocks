export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  CALL_QUEUE: DurableObjectNamespace;
  // Set via wrangler secret
  JWT_SECRET: string;
  VONAGE_API_KEY: string;
  VONAGE_API_SECRET: string;
  VONAGE_APPLICATION_ID: string;
  VONAGE_PRIVATE_KEY: string;
  ENVIRONMENT: string;
}
