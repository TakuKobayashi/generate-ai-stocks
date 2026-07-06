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
    'You are translating a short project description for a GitHub README that catalogs software projects built with the help of generative AI.',
    'Translate the Japanese description into natural, concise English suitable for a portfolio/project table entry (roughly one sentence, no more than ~40 words).',
    '',
    'Rules:',
    '- Keep proper nouns, product/repo names, and technology names as-is (e.g. Cloudflare Workers, Next.js, Unity, Kotlin, Swift).',
    '- Keep numbers, versions, and technical terms unchanged.',
    '- Do not add information that is not in the source text.',
    '- Do not include your reasoning, notes, or any text other than the JSON object below.',
    '- Output must be a single-line JSON object, with no markdown code fences and no text before or after it.',
    '',
    'Output format (exact shape, no extra fields):',
    '{"translation": "<English translation here>"}',
    '',
    'Example:',
    '日本語: 位置情報を使ったAR宝探しアプリ。Unityとクラウド連携で作成。',
    '{"translation": "A location-based AR treasure hunt app built with Unity and cloud integration."}',
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
      // Local Ollama instance — no need to cap generation length.
      // -1 tells Ollama to generate until it hits a natural stop
      // (or the model's context limit), rather than being cut off early.
      think: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: -1,
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  }

  let data: {
    response?: string;
    thinking?: string;
  };

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (!data.response || !data.response.trim()) {
    throw new Error(
      `Missing response${data.thinking ? ` (model produced only thinking output: ${data.thinking.slice(0, 200)})` : ''}`,
    );
  }

  return parseTranslation(data.response);
}

export async function translateProjects(options: TranslateProjectsOptions = {}) {
  const resolvedOptions = {
    ollamaUrl: options.ollamaUrl || DEFAULT_OLLAMA_URL,
    ollamaModel: options.ollamaModel || DEFAULT_OLLAMA_MODEL,
  };
  const files = await fg('projects/*/project.yml');
  const failures: string[] = [];

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
      failures.push(file);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to translate ${failures.length} project.yml file(s): ${failures.join(', ')}`);
  }
}
