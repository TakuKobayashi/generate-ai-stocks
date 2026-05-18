import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function syncPortfolio() {
  const entries = await fs.readdir("projects", {
    withFileTypes: true
  });

  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const projectDir = path.join("projects", slug);

    const ymlPath = path.join(projectDir, "project.yml");
    const readmePath = path.join(projectDir, "README.md");

    try {
      if (await exists(ymlPath)) {
        const raw = await fs.readFile(ymlPath, "utf8");
        const data: any = yaml.load(raw);

        projects.push({
          name: data.name || slug,
          slug: data.slug || slug,
          description: data.description || "",
          status: data.status || "incubating",
          repo: data.repo || "",
          tags: data.tags || []
        });

        continue;
      }

      if (await exists(readmePath)) {
        projects.push({
          name: slug,
          slug,
          description: "",
          status: "incubating",
          repo: "",
          tags: []
        });
      }
    } catch (err) {
      console.error(`Failed loading ${slug}:`, err);
    }
  }

  projects.sort((a, b) => a.slug.localeCompare(b.slug));

  await fs.mkdir("portfolio", { recursive: true });

  await fs.writeFile(
    "portfolio/projects.json",
    JSON.stringify(projects, null, 2),
    "utf8"
  );

  await fs.writeFile(
    "portfolio/projects.yml",
    yaml.dump(projects),
    "utf8"
  );

  console.log(`Synced ${projects.length} projects.`);
}