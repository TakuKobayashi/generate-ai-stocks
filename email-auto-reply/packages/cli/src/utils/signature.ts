import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

export function loadSignature(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    logger.warn(`署名ファイルが見つかりません: ${resolved}`);
    return '';
  }
  return fs.readFileSync(resolved, 'utf-8');
}
