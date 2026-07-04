import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

type GenerateProjectYmlOptions = {
  ollamaUrl?: string;
  ollamaModel?: string;
  project?: string;
  force?: boolean;
};

type GeneratedProject = {
  description?: unknown;
  description_ja?: unknown;
  tags?: unknown;
  status?: unknown;
  repo?: unknown;
};

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma3:12b';
const DEFAULT_STATUS = 'incubating';
const MAX_CONTEXT_CHARS = 24000;
const STATUSES = new Set(['incubating', 'active', 'archived']);

const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
]);

const CONTEXT_FILES = [
  'README.md',
  'README.ja.md',
  'package.json',
  'wrangler.json',
  'wrangler.jsonc',
  'vite.config.ts',
  'vite.config.js',
  'next.config.ts',
  'next.config.js',
  'tsconfig.json',
  'Cargo.toml',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'settings.gradle',
  'settings.gradle.kts',
  'build.gradle',
  'build.gradle.kts',
  'app/build.gradle',
  'app/build.gradle.kts',
  'compose.yaml',
  'docker-compose.yml',
  'Dockerfile',
];

function normalizeOllamaUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function asStatus(value: unknown) {
  const status = asString(value);
  return STATUSES.has(status) ? status : DEFAULT_STATUS;
}

function safeJsonParse(raw: string): GeneratedProject {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error(`Invalid model JSON: ${cleaned.slice(0, 300)}`);
  }

  return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as GeneratedProject;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readIfExists(filePath: string, maxChars: number) {
  if (!(await pathExists(filePath))) return '';

  const raw = await fs.readFile(filePath, 'utf8');
  return raw.slice(0, maxChars);
}

async function getProjectTree(projectDir: string) {
  const files = await fg('**/*', {
    cwd: projectDir,
    onlyFiles: true,
    dot: true,
    deep: 4,
    ignore: [...EXCLUDED_DIRS].map((dir) => `**/${dir}/**`),
  });

  return files
    .filter(
      (file) =>
        file !== '.git' &&
        !file.endsWith('.lock') &&
        !file.endsWith('.png') &&
        !file.endsWith('.jpg') &&
        !file.endsWith('.jpeg') &&
        !file.endsWith('.webp'),
    )
    .sort()
    .slice(0, 180)
    .join('\n');
}

async function getGitRemote(projectDir: string) {
  const gitFile = path.join(projectDir, '.git');
  const content = await readIfExists(gitFile, 500);
  const match = content.match(/gitdir:\s*(.+)/i);
  if (!match) return '';

  const gitDir = path.resolve(projectDir, match[1].trim());
  const config = await readIfExists(path.join(gitDir, 'config'), 2000);
  const urlMatch = config.match(/\[remote "origin"\][\s\S]*?\n\s*url\s*=\s*(.+)/);

  return urlMatch?.[1]?.trim() || '';
}

async function buildProjectContext(projectDir: string, slug: string) {
  const parts = [`Project slug: ${slug}`];
  const tree = await getProjectTree(projectDir);

  if (tree) {
    parts.push(`File tree:\n${tree}`);
  }

  for (const file of CONTEXT_FILES) {
    const content = await readIfExists(path.join(projectDir, file), 6000);
    if (content) {
      parts.push(`File: ${file}\n${content}`);
    }
  }

  return parts.join('\n\n---\n\n').slice(0, MAX_CONTEXT_CHARS);
}

function buildPrompt(slug: string, context: string) {
  return [
    'You create project.yml metadata for a portfolio repository.',
    'Infer the project purpose from the repository files.',
    'Return only JSON with this exact shape:',
    '{"description":"English one-sentence description","description_ja":"Japanese one-sentence description","tags":["tag"],"status":"incubating"}',
    'Rules:',
    '- description must be natural, specific, and concise for a README project table.',
    '- description_ja must be natural Japanese, not a literal word-by-word translation.',
    '- tags must contain 3 to 8 short technology or domain tags.',
    '- status must be one of: incubating, active, archived.',
    '- Do not invent unavailable repository URLs.',
    '',
    `Project slug: ${slug}`,
    '',
    context,
  ].join('\n');
}

async function generateMetadata(
  slug: string,
  context: string,
  options: Required<Pick<GenerateProjectYmlOptions, 'ollamaUrl' | 'ollamaModel'>>,
) {
  const res = await fetch(`${normalizeOllamaUrl(options.ollamaUrl)}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: options.ollamaModel,
      prompt: buildPrompt(slug, context),
      stream: false,
      format: 'json',
      options: {
        temperature: 0.2,
        top_p: 0.9,
        num_predict: 360,
      },
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }

  const data = JSON.parse(raw) as {
    response?: string;
  };

  if (!data.response) {
    throw new Error('Missing Ollama response');
  }

  return safeJsonParse(data.response);
}

async function listProjectDirs(project?: string) {
  if (project) {
    const projectDir = path.join('projects', project);
    if (!(await pathExists(projectDir))) {
      throw new Error(`Project not found: ${project}`);
    }

    return [projectDir];
  }

  return fg('projects/*', {
    onlyDirectories: true,
  });
}

export async function generateProjectYml(options: GenerateProjectYmlOptions = {}) {
  const ollamaUrl = options.ollamaUrl || DEFAULT_OLLAMA_URL;
  const ollamaModel = options.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const projectDirs = await listProjectDirs(options.project);

  for (const projectDir of projectDirs) {
    const slug = path.basename(projectDir);
    const projectYmlPath = path.join(projectDir, 'project.yml');

    if (!options.force && (await pathExists(projectYmlPath))) {
      console.log(`Skipped existing: ${projectYmlPath}`);
      continue;
    }

    const context = await buildProjectContext(projectDir, slug);
    if (!context.trim()) {
      console.warn(`Skipped empty project: ${projectDir}`);
      continue;
    }

    console.log(`Generating ${projectYmlPath} with ${ollamaModel}`);

    const generated = await generateMetadata(slug, context, {
      ollamaUrl,
      ollamaModel,
    });

    const repo = asString(generated.repo) || (await getGitRemote(projectDir));
    const description = asString(generated.description) || `${slug} project.`;
    const descriptionJa = asString(generated.description_ja) || `${slug} project metadata.`;
    const project = {
      name: slug,
      slug,
      description,
      description_ja: descriptionJa,
      translation_locked: false,
      status: asStatus(generated.status),
      repo,
      tags: asTags(generated.tags),
    };

    await fs.writeFile(
      projectYmlPath,
      yaml.dump(project, {
        lineWidth: -1,
      }),
      'utf8',
    );

    console.log(`Generated: ${projectYmlPath}`);
  }
}
