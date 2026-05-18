/**
 * core/temp.ts
 * リクエスト / ジョブごとの一時ファイル管理（CLI・API 共通）
 */

import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";
import { v4 as uuidv4 } from "uuid";

const TEMP_BASE = process.env.TEMP_DIR ?? os.tmpdir();

export interface TempContext {
  dir: string;
  filePath: (name: string) => string;
  cleanup: () => void;
}

export function createTempContext(): TempContext {
  const dir = path.join(TEMP_BASE, `doc-scanner-${uuidv4()}`);
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    filePath: (name: string) => path.join(dir, name),
    cleanup: () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

export function writeTempFile(filePath: string, buffer: Buffer): void {
  fs.writeFileSync(filePath, buffer);
}

export function readAsBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString("base64");
}
