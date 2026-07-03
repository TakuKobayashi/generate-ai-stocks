import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";
import { DEFAULT_CONFIG_YAML } from "../utils/config.js";
import chalk from "chalk";

export async function initCommand(): Promise<void> {
  const configPath = path.resolve("signalforge.yml");
  const signalforgeDir = path.resolve(".signalforge");
  const draftsDir = path.resolve("drafts");
  const outputDir = path.resolve("output");

  logger.section("Initializing SignalForge");

  // Create directories
  for (const dir of [signalforgeDir, draftsDir, outputDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.success(`Created ${path.relative(process.cwd(), dir)}/`);
    } else {
      logger.dim(`${path.relative(process.cwd(), dir)}/ already exists`);
    }
  }

  // Write config
  if (fs.existsSync(configPath)) {
    logger.warn("signalforge.yml already exists — skipping.");
  } else {
    fs.writeFileSync(configPath, DEFAULT_CONFIG_YAML, "utf-8");
    logger.success("Created signalforge.yml");
  }

  // Write .gitignore additions
  const gitignorePath = path.resolve(".gitignore");
  const toIgnore = ".signalforge/\n.env\n";
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, toIgnore);
    logger.success("Created .gitignore");
  } else {
    const existing = fs.readFileSync(gitignorePath, "utf-8");
    if (!existing.includes(".signalforge/")) {
      fs.appendFileSync(gitignorePath, `\n# SignalForge\n${toIgnore}`);
      logger.success("Updated .gitignore");
    }
  }

  // Write .env template
  const envTemplatePath = path.resolve(".env.example");
  if (!fs.existsSync(envTemplatePath)) {
    const envTemplate = `# SignalForge — API Keys
# Copy this file to .env and fill in your keys

# AI Provider (choose one)
GEMINI_API_KEY=
GROQ_API_KEY=

# Image Search (optional)
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
PIXABAY_API_KEY=

# Source Providers (future)
# GITHUB_TOKEN=
# ASANA_PAT=
# SLACK_BOT_TOKEN=
`;
    fs.writeFileSync(envTemplatePath, envTemplate, "utf-8");
    logger.success("Created .env.example");
  }

  console.log("");
  console.log(chalk.bold.green("✨ SignalForge initialized!"));
  console.log("");
  console.log(chalk.white("Next steps:"));
  console.log(chalk.dim("  1. Edit signalforge.yml with your profile and repos"));
  console.log(chalk.dim("  2. Copy .env.example → .env and add your API keys"));
  console.log(chalk.dim("  3. Run: signalforge collect --config ./signalforge.yml"));
  console.log(chalk.dim("  4. Run: signalforge draft"));
  console.log("");
}
