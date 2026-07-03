import fs from "fs";
import path from "path";
import axios from "axios";
import type {
  ActivityLog,
  AIProvider,
  MediaAsset,
  MediaProvider,
  PublishTarget,
  SignalForgeConfig,
} from "../types/index.js";
import { buildImageQueryPrompt } from "../prompts/index.js";
import { PexelsProvider } from "./pexels.js";

// ─── Provider Selection ───────────────────────────────────────────────────────

function createMediaProvider(
  config: SignalForgeConfig
): MediaProvider | null {
  if (!config.media.enabled || config.media.mode === "none") return null;

  if (config.media.pexelsApiKey) {
    return new PexelsProvider(config.media.pexelsApiKey);
  }

  const envKey =
    process.env["PEXELS_API_KEY"] ??
    process.env["UNSPLASH_ACCESS_KEY"] ??
    process.env["PIXABAY_API_KEY"];

  if (process.env["PEXELS_API_KEY"]) {
    return new PexelsProvider(process.env["PEXELS_API_KEY"]);
  }

  if (!envKey) return null;

  return null;
}

// ─── Download Image ───────────────────────────────────────────────────────────

async function downloadImage(
  url: string,
  destPath: string
): Promise<void> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 15_000,
  });
  fs.writeFileSync(destPath, Buffer.from(response.data as ArrayBuffer));
}

// ─── Fetch Media for Draft ────────────────────────────────────────────────────

export async function fetchMediaForDraft(
  logs: ActivityLog[],
  target: PublishTarget,
  outputDir: string,
  baseFilename: string,
  ai: AIProvider,
  config: SignalForgeConfig
): Promise<MediaAsset | undefined> {
  const provider = createMediaProvider(config);
  if (!provider) return undefined;

  try {
    // Ask AI to generate a search query
    const queryPrompt = buildImageQueryPrompt(logs, target);
    const searchQuery = await ai.complete(queryPrompt);
    const cleanQuery = searchQuery.replace(/["']/g, "").trim();

    const results = await provider.search(cleanQuery, 1);
    const asset = results[0];
    if (!asset) return undefined;

    // Download the image
    const ext = asset.url.includes(".jpg") ? ".jpg" : ".png";
    const localFilename = `${baseFilename}${ext}`;
    const localPath = path.join(outputDir, localFilename);
    fs.mkdirSync(outputDir, { recursive: true });

    await downloadImage(asset.url, localPath);

    return { ...asset, localPath, query: cleanQuery };
  } catch {
    // Media failures are non-fatal
    return undefined;
  }
}
