import { Command } from "commander";
import { addProject } from "./init-project";
import { syncPortfolio } from "./sync-portfolio";
import { syncReadme } from "./sync-readme";
import { validateProjects } from "./validate-projects";
import { updateSubmodules } from "./update-submodules";
import { pushSubmodules } from "./push-submodules";
import { execSync } from "child_process";

const program = new Command();

program
  .command("add")
  .requiredOption("--name <name>")
  .description("Add new project")
  .action(async (opts) => {
    await addProject(opts.name);
    await syncPortfolio();
    await syncReadme();
  });

program
  .command("sync")
  .description("Sync portfolio + README")
  .action(async () => {
    await syncPortfolio();
    await syncReadme();
  });

program.command("readme").action(syncReadme);

program.command("validate").action(validateProjects);

program.command("pull").action(updateSubmodules);

program.command("push").action(pushSubmodules);

program.command("status").action(async () => {
  execSync("git submodule foreach git status", { stdio: "inherit" });
});

program.parse();
