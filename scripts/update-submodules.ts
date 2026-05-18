import { execSync } from "child_process";

export async function updateSubmodules() {
  execSync("git pull", {
    stdio: "inherit"
  });

  execSync(
    "git submodule update --init --recursive --remote --merge",
    {
      stdio: "inherit"
    }
  );
}