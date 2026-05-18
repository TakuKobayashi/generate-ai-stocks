/**
 * core/image.ts
 * Sharp を使った画像フォーマット変換ユーティリティ（CLI・API 共通）
 */

import sharp from "sharp";
import * as path from "path";

export type ImageFormat = "jpg" | "jpeg" | "png" | "webp" | "tiff" | "bmp" | "avif";

export const SUPPORTED_FORMATS: ImageFormat[] = [
  "jpg", "jpeg", "png", "webp", "tiff", "bmp", "avif",
];

export const FORMAT_TO_MIME: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
  bmp:  "image/bmp",
  avif: "image/avif",
};

export const MIME_TO_FORMAT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/png":  "png",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/bmp":  "bmp",
  "image/avif": "avif",
};

/** ファイルパスから拡張子（フォーマット）を取得する */
export function extFromPath(filePath: string): string {
  return path.extname(filePath).toLowerCase().replace(".", "") || "jpg";
}

/** 拡張子を検証してサポート済みのものだけ返す（デフォルト: jpg） */
export function safeExt(ext: string): string {
  return (SUPPORTED_FORMATS as string[]).includes(ext) ? ext : "jpg";
}

/** PNG 一時ファイルを元のフォーマットに変換して保存する */
export async function convertFormat(
  srcPath: string,
  destPath: string,
  ext: string
): Promise<void> {
  const img = sharp(srcPath);
  switch (ext) {
    case "jpg":
    case "jpeg": await img.jpeg({ quality: 95 }).toFile(destPath); break;
    case "png":  await img.png({ compressionLevel: 6 }).toFile(destPath); break;
    case "webp": await img.webp({ quality: 95 }).toFile(destPath); break;
    case "tiff": await img.tiff().toFile(destPath); break;
    case "avif": await img.avif({ quality: 80 }).toFile(destPath); break;
    default:     await img.jpeg({ quality: 95 }).toFile(destPath); break;
  }
}

/** sharp で画像フォーマットを判定する（ファイル内容から） */
export async function detectFormat(filePath: string): Promise<string> {
  try {
    const meta = await sharp(filePath).metadata();
    return meta.format ?? extFromPath(filePath);
  } catch {
    return extFromPath(filePath);
  }
}
