import { Command } from 'commander';
import { addProject } from './init-project';
import { translateProjects } from './translate-projects';
import { syncPortfolio } from './sync-portfolio';
import { syncReadme } from './sync-readme';
import { validateProjects } from './validate-projects';
import { updateSubmodules } from './update-submodules';
import { pushSubmodules } from './push-submodules';
import { generateProjectYml } from './generate-project-yml';

const program = new Command();

type TranslateOptions = {
  ollamaUrl?: string;
  ollamaModel?: string;
};

function addTranslateOptions(command: Command) {
  return command
    .option('--ollama-url <url>', 'Ollama server URL', 'http://localhost:11434')
    .option('--ollama-model <model>', 'Ollama model to use for translation', 'qwen3:4b');
}

function toTranslateOptions(opts: TranslateOptions) {
  return {
    ollamaUrl: opts.ollamaUrl,
    ollamaModel: opts.ollamaModel,
  };
}

addTranslateOptions(program.command('add').requiredOption('--name <name>').option('--description <description>', ''))
  .description('Add new project')
  .action(async (opts) => {
    await addProject(opts.name, opts.description);

    await translateProjects(toTranslateOptions(opts));
    await syncPortfolio();
    await syncReadme();
  });

addTranslateOptions(program.command('translate'))
  .description('Auto translate project.yml descriptions')
  .action(async (opts) => {
    await translateProjects(toTranslateOptions(opts));
  });

addTranslateOptions(program.command('sync'))
  .description('Translate + Sync portfolio + README')
  .action(async (opts) => {
    await translateProjects(toTranslateOptions(opts));
    await syncPortfolio();
    await syncReadme();
  });

program.command('readme').description('Sync README only').action(syncReadme);

program.command('validate').description('Validate project.yml files').action(validateProjects);

program
  .command('generate-project-yml')
  .description('Generate missing project.yml files from project contents with Ollama')
  .option('--ollama-url <url>', 'Ollama server URL', 'http://localhost:11434')
  .option('--ollama-model <model>', 'Ollama model to use for project metadata generation', 'gemma3:12b')
  .option('--project <slug>', 'Generate project.yml for a single project')
  .option('--force', 'Overwrite existing project.yml files', false)
  .action(async (opts) => {
    await generateProjectYml({
      ollamaUrl: opts.ollamaUrl,
      ollamaModel: opts.ollamaModel,
      project: opts.project,
      force: opts.force,
    });
  });

program.command('pull').description('Pull parent + all submodules').action(updateSubmodules);

program.command('push').description('Push all submodules + parent').action(pushSubmodules);

program
  .command('status')
  .description('Check submodule status')
  .action(async () => {
    const { execSync } = await import('child_process');

    execSync('git submodule foreach git status', {
      stdio: 'inherit',
    });
  });

program.parse();
