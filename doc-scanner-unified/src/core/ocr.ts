/**
 * core/ocr.ts
 * Tesseract.js を使用した OCR（CLI・API 共通）
 */

import Tesseract from "tesseract.js";
import * as path from "path";

export type OcrLanguage = "jpn" | "eng" | "jpn+eng";

export interface OcrResult {
  success: boolean;
  text?: string;
  confidence?: number;
  message?: string;
}

const TESSDATA_DIR =
  process.env.TESSDATA_DIR ?? path.join(process.cwd(), "tessdata");

export async function performOcr(
  imagePath: string,
  lang: OcrLanguage = "jpn+eng",
  onProgress?: (pct: number) => void
): Promise<OcrResult> {
  try {
    const worker = await Tesseract.createWorker(lang, 1, {
      langPath: TESSDATA_DIR,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    const result = await worker.recognize(imagePath);
    await worker.terminate();

    return {
      success: true,
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } catch (err) {
    return {
      success: false,
      message: `OCR 処理エラー: ${(err as Error).message}`,
    };
  }
}
