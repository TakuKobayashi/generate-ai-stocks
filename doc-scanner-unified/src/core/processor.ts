/**
 * core/processor.ts
 * スキャン + OCR パイプライン（CLI・API 共通のコアロジック）
 */

import * as fs   from "fs";
import * as path from "path";
import { scanDocument }           from "./scanner";
import { performOcr, OcrLanguage } from "./ocr";
import { convertFormat, detectFormat } from "./image";
import { createTempContext, writeTempFile, readAsBase64 } from "./temp";

// ─────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────

export interface ProcessOptions {
  lang:     OcrLanguage;
  skipScan: boolean;
  skipOcr:  boolean;
  onProgress?: (phase: "scan" | "ocr", pct: number) => void;
}

/** ファイルパスベースの処理（CLI 用） */
export interface FileProcessOptions extends ProcessOptions {
  outputDir: string;
}

export interface FileProcessResult {
  inputPath:    string;
  scanSuccess:  boolean;
  ocrSuccess:   boolean;
  scanOutputPath?: string;
  ocrOutputPath?:  string;
  ocrConfidence?:  number;
  errors: string[];
}

/** バッファベースの処理（API 用） */
export interface BufferProcessOptions extends ProcessOptions {
  filename: string;  // 拡張子の判定に使う
}

export interface BufferProcessResult {
  scan?: {
    buffer:   Buffer;
    mimeType: string;
    scanned:  boolean;   // true=補正済み / false=元画像フォールバック
    message?: string;
  };
  ocr?: {
    text:       string;
    confidence: number;
    lang:       string;
  };
  errors: string[];
}

// ─────────────────────────────────────────
// ファイルベース処理（CLI）
// ─────────────────────────────────────────

export async function processFile(
  inputPath: string,
  opts: FileProcessOptions
): Promise<FileProcessResult> {
  const result: FileProcessResult = {
    inputPath,
    scanSuccess: false,
    ocrSuccess:  false,
    errors: [],
  };

  fs.mkdirSync(opts.outputDir, { recursive: true });

  const basename   = path.basename(inputPath, path.extname(inputPath));
  const ext        = await detectFormat(inputPath);
  const dotExt     = path.extname(inputPath).replace(".", "") || ext;

  let imageForOcr = inputPath;

  // ── スキャン補正 ──────────────────────────────
  if (!opts.skipScan) {
    const tmpPng     = path.join(opts.outputDir, `__tmp_${basename}.png`);
    const scannedOut = path.join(opts.outputDir, `${basename}_scanned.${dotExt}`);

    const scanResult = await scanDocument(inputPath, tmpPng);

    if (scanResult.success && fs.existsSync(tmpPng)) {
      try {
        await convertFormat(tmpPng, scannedOut, dotExt);
        result.scanSuccess   = true;
        result.scanOutputPath = scannedOut;
        imageForOcr          = scannedOut;
      } catch (e) {
        result.errors.push(`フォーマット変換エラー: ${(e as Error).message}`);
      } finally {
        try { fs.unlinkSync(tmpPng); } catch { /* ignore */ }
      }
    } else {
      result.errors.push(`スキャンスキップ: ${scanResult.message}`);
    }
  }

  // ── OCR ──────────────────────────────────────
  if (!opts.skipOcr) {
    const ocrOut = path.join(opts.outputDir, `${basename}.txt`);

    let lastPct = -1;
    const ocrResult = await performOcr(imageForOcr, opts.lang, (pct) => {
      if (pct !== lastPct) {
        opts.onProgress?.("ocr", pct);
        lastPct = pct;
      }
    });

    if (ocrResult.success && ocrResult.text !== undefined) {
      fs.writeFileSync(ocrOut, ocrResult.text, "utf-8");
      result.ocrSuccess    = true;
      result.ocrOutputPath  = ocrOut;
      result.ocrConfidence  = ocrResult.confidence;
    } else {
      result.errors.push(`OCR エラー: ${ocrResult.message}`);
    }
  }

  return result;
}

// ─────────────────────────────────────────
// バッファベース処理（API）
// ─────────────────────────────────────────

export async function processBuffer(
  inputBuffer: Buffer,
  opts: BufferProcessOptions
): Promise<BufferProcessResult> {
  const result: BufferProcessResult = { errors: [] };
  const tmp = createTempContext();

  try {
    const ext     = opts.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const safeExt = ["jpg","jpeg","png","webp","tiff","bmp","avif"].includes(ext) ? ext : "jpg";
    const mime    = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png",
                      webp:"image/webp", tiff:"image/tiff", bmp:"image/bmp",
                      avif:"image/avif" }[safeExt] ?? "image/jpeg";

    const inputPath = tmp.filePath(`input.${safeExt}`);
    writeTempFile(inputPath, inputBuffer);

    let imageForOcr = inputPath;

    // ── スキャン補正 ──────────────────────────────
    if (!opts.skipScan) {
      const tmpPng     = tmp.filePath("scan_raw.png");
      const scannedOut = tmp.filePath(`scanned.${safeExt}`);
      const scanResult = await scanDocument(inputPath, tmpPng);

      if (scanResult.success && fs.existsSync(tmpPng)) {
        await convertFormat(tmpPng, scannedOut, safeExt);
        imageForOcr = scannedOut;
        result.scan = {
          buffer:   fs.readFileSync(scannedOut),
          mimeType: mime,
          scanned:  true,
        };
      } else {
        result.errors.push(`スキャンスキップ: ${scanResult.message}`);
        result.scan = {
          buffer:   inputBuffer,
          mimeType: mime,
          scanned:  false,
          message:  scanResult.message,
        };
      }
    }

    // ── OCR ──────────────────────────────────────
    if (!opts.skipOcr) {
      let lastPct = -1;
      const ocrResult = await performOcr(imageForOcr, opts.lang, (pct) => {
        if (pct !== lastPct) {
          opts.onProgress?.("ocr", pct);
          lastPct = pct;
        }
      });

      if (ocrResult.success && ocrResult.text !== undefined) {
        result.ocr = {
          text:       ocrResult.text,
          confidence: ocrResult.confidence ?? 0,
          lang:       opts.lang,
        };
      } else {
        result.errors.push(`OCR エラー: ${ocrResult.message}`);
      }
    }
  } finally {
    tmp.cleanup();
  }

  return result;
}
