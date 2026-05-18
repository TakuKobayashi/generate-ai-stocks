/**
 * メールパーサー (Cloudflare Workers 版)
 * Buffer は使わず atob / TextDecoder を使用する
 */

export function truncateBody(body: string, maxLength = 3000): string {
  if (body.length <= maxLength) return body;
  return body.substring(0, maxLength) + '\n\n... (以下省略)';
}

function base64urlDecode(data: string): string {
  // base64url → base64 → decode
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const binary  = atob(base64);
  return decodeURIComponent(escape(binary));
}

export function extractGmailBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';

  const mimeType = payload['mimeType'] as string | undefined;
  const body     = payload['body']     as Record<string, unknown> | undefined;
  const parts    = payload['parts']    as Record<string, unknown>[] | undefined;

  if (mimeType === 'text/plain' && body?.['data']) {
    return base64urlDecode(body['data'] as string);
  }
  if (mimeType === 'text/html' && body?.['data']) {
    // Workers では html-to-text が動かないため、タグを除去したプレーンテキストで代替
    return base64urlDecode(body['data'] as string).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (parts && parts.length > 0) {
    for (const part of parts) {
      if ((part['mimeType'] as string) === 'text/plain' && (part['body'] as Record<string, unknown>)?.['data']) {
        return base64urlDecode((part['body'] as Record<string, unknown>)['data'] as string);
      }
    }
    for (const part of parts) {
      const result = extractGmailBody(part);
      if (result) return result;
    }
  }
  return '';
}

export function getGmailHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string
): string {
  if (!headers) return '';
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}
