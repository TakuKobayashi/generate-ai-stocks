import axios from "axios";
import type { MediaAsset, MediaProvider } from "../types/index.js";

// ─── Pexels Provider ──────────────────────────────────────────────────────────

export class PexelsProvider implements MediaProvider {
  readonly name = "pexels";

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, count: number = 1): Promise<MediaAsset[]> {
    const response = await axios.get("https://api.pexels.com/v1/search", {
      headers: { Authorization: this.apiKey },
      params: { query, per_page: count, orientation: "landscape" },
      timeout: 10_000,
    });

    const photos = response.data?.photos ?? [];

    return photos.map(
      (p: {
        src: { large: string };
        photographer: string;
        photographer_url: string;
        url: string;
      }) => ({
        url: p.src.large,
        query,
        attribution: `Photo by ${p.photographer} on Pexels (${p.url})`,
      })
    );
  }
}
