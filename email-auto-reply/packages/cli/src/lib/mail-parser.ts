import { htmlToText } from 'html-to-text';

export function htmlToPlainText(html: string): string {
  return htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
    ],
  });
}

export function truncateBody(body: string, maxLength = 3000): string {
  if (body.length <= maxLength) return body;
  return body.substring(0, maxLength) + '\n\n... (以下省略)';
}

export function extractGmailBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return '';

  const mimeType = payload['mimeType'] as string | undefined;
  const body     = payload['body']     as Record<string, unknown> | undefined;
  const parts    = payload['parts']    as Record<string, unknown>[] | undefined;

  if (mimeType === 'text/plain' && body?.['data']) {
    return Buffer.from(body['data'] as string, 'base64url').toString('utf-8');
  }
  if (mimeType === 'text/html' && body?.['data']) {
    return htmlToPlainText(Buffer.from(body['data'] as string, 'base64url').toString('utf-8'));
  }
  if (parts && parts.length > 0) {
    for (const part of parts) {
      if ((part['mimeType'] as string) === 'text/plain' && (part['body'] as Record<string, unknown>)?.['data']) {
        return Buffer.from((part['body'] as Record<string, unknown>)['data'] as string, 'base64url').toString('utf-8');
      }
    }
    for (const part of parts) {
      if ((part['mimeType'] as string) === 'text/html' && (part['body'] as Record<string, unknown>)?.['data']) {
        return htmlToPlainText(Buffer.from((part['body'] as Record<string, unknown>)['data'] as string, 'base64url').toString('utf-8'));
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
