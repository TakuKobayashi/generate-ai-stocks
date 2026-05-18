import fg from "fast-glob";
import fs from "fs/promises";
import yaml from "js-yaml";

type Project = {
  name: string;
  slug: string;
  description?: string;
  description_ja?: string;
  translation_locked?: boolean;
  status: string;
  repo?: string;
  tags?: string[];
};

async function translateText(text: string): Promise<string> {
  const res = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: text,
      source: "ja",
      target: "en",
      format: "text",
    }),
  });

  if (!res.ok) {
    throw new Error(`Translation failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    translatedText: string;
  };

  return data.translatedText;
}

export async function translateProjects() {
  const files = await fg("projects/*/project.yml");

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf8");

      const data = yaml.load(raw) as Project;

      if (data.translation_locked || data.description || !data.description_ja) {
        continue;
      }

      const translated = await translateText(data.description_ja);

      data.description = translated.trim();

      await fs.writeFile(
        file,
        yaml.dump(data, {
          lineWidth: -1,
        }),
        "utf8",
      );

      console.log(`Translated: ${file}`);
    } catch (err) {
      console.error(`Failed translating ${file}:`, err);
    }
  }
}
