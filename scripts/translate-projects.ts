import fg from 'fast-glob';
import fs from 'fs/promises';
import yaml from 'js-yaml';

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

export type TranslateProjectsOptions = {
  ollamaUrl?: string;
  ollamaModel?: string;
};

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b';

function buildPrompt(text: string) {
  return [
    'Translate the following Japanese project description into natural, concise English for a GitHub README project table.',
    'Return only JSON with this exact shape: {"translation":"..."}',
    'Do not add explanations, markdown, quotes around the whole response, or extra fields.',
    'Preserve product names, repository names, technical terms, and numbers.',
    '',
    `Japanese: ${text}`,
  ].join('\n');
}

function parseTranslation(raw: string): string {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const data = JSON.parse(cleaned) as {
      translation?: unknown;
    };

    if (typeof data.translation === 'string' && data.translation.trim()) {
      return data.translation.trim();
    }
  } catch {
    // Fall through to a plain-text response so a useful translation is not discarded.
  }

  if (!cleaned) {
    throw new Error('Missing translation');
  }

  return cleaned;
}

async function translateText(text: string, options: Required<TranslateProjectsOptions>): Promise<string> {
  const res = await fetch(`${options.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: options.ollamaModel,
      prompt: buildPrompt(text),
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 160,
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  }

  let data: {
    response?: string;
  };

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (!data.response) {
    throw new Error('Missing response');
  }

  return parseTranslation(data.response);
}

export async function translateProjects(options: TranslateProjectsOptions = {}) {
  const resolvedOptions = {
    ollamaUrl: options.ollamaUrl || DEFAULT_OLLAMA_URL,
    ollamaModel: options.ollamaModel || DEFAULT_OLLAMA_MODEL,
  };
  const files = await fg('projects/*/project.yml');

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf8');

      const data = yaml.load(raw) as Project;

      if (data.translation_locked || data.description || !data.description_ja) {
        continue;
      }

      console.log(`Translating with ${resolvedOptions.ollamaModel}: ${file}`);

      data.description = await translateText(data.description_ja, resolvedOptions);

      await fs.writeFile(
        file,
        yaml.dump(data, {
          lineWidth: -1,
        }),
        'utf8',
      );

      console.log(`Translated: ${file}`);
    } catch (err) {
      console.error(`Failed translating ${file}:`, err);
    }
  }
}
