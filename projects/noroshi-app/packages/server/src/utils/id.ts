/**
 * Cloudflare Workers環境でUUID v4を生成
 */
export function generateId(): string {
  return crypto.randomUUID();
}
