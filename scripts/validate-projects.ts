import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

export async function validateProjects() {
  const dirs = await fs.readdir("projects");

  for (const dir of dirs) {
    const file = path.join("projects", dir, "project.yml");

    try {
      const raw = await fs.readFile(file, "utf8");
      const data: any = yaml.load(raw);

      ["name", "slug", "status"].forEach((field) => {
        if (!data[field]) {
          throw new Error(`${dir}: missing ${field}`);
        }
      });
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  console.log("All projects valid.");
}