import fs from "fs";
import path from "path";
import { input } from "@inquirer/prompts";
import { logger } from "../utils/logger.js";
import chalk from "chalk";

type AuthTarget = "github" | "asana" | "slack";

const AUTH_CONFIG: Record<
  AuthTarget,
  { envKey: string; label: string; hint: string }
> = {
  github: {
    envKey: "GITHUB_TOKEN",
    label: "GitHub Personal Access Token",
    hint: "https://github.com/settings/tokens — needs: read:user, repo (public_repo for public only)",
  },
  asana: {
    envKey: "ASANA_PAT",
    label: "Asana Personal Access Token",
    hint: "https://app.asana.com/0/my-apps — create a Personal Access Token",
  },
  slack: {
    envKey: "SLACK_BOT_TOKEN",
    label: "Slack Bot Token",
    hint: "https://api.slack.com/apps — create app → OAuth → Bot Token (xoxb-...)",
  },
};

export async function authCommand(target: AuthTarget): Promise<void> {
  const cfg = AUTH_CONFIG[target];
  if (!cfg) {
    logger.error(`Unknown auth target: ${target as string}`);
    process.exit(1);
  }

  logger.section(`Auth: ${target}`);
  console.log(chalk.dim(`  ℹ  ${cfg.hint}`));
  console.log("");

  const token = await input({
    message: `Enter your ${cfg.label}:`,
    validate: (v) => v.length > 0 || "Token cannot be empty",
  });

  // Write to .env file
  const envPath = path.resolve(".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const keyLine = `${cfg.envKey}=${token}`;

  if (envContent.includes(`${cfg.envKey}=`)) {
    // Replace existing
    envContent = envContent.replace(
      new RegExp(`^${cfg.envKey}=.*$`, "m"),
      keyLine
    );
  } else {
    envContent += `\n${keyLine}\n`;
  }

  fs.writeFileSync(envPath, envContent, "utf-8");
  logger.success(`${cfg.envKey} saved to .env`);

  console.log("");
  console.log(chalk.dim("  Token stored in .env — make sure .env is in .gitignore!"));
}
